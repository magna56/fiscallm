"""The FiscaLLM meter. Standard library only.

Tracking calls only queue an event; a background thread sends batches. The
meter never raises and never blocks the caller, except ``flush()``.
"""

from __future__ import annotations

import atexit
import json
import os
import logging
import threading
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterable, AsyncIterator, Callable, Dict, Iterable, Iterator, List, Optional, TypeVar, Union

from .usage import StreamUsage, Usage, from_anthropic, from_gemini, from_openai

DEFAULT_ENDPOINT = "https://fiscallm.com/api/v1/events"
MAX_BATCH = 100
TIMEOUT_S = 2.0
RETRY_DELAY_S = 0.25
INTERVAL_S = 2.0
# check() waits this long at most, then lets the call through, and remembers
# an answer briefly so a busy backend does not ask on every request.
CHECK_TIMEOUT_S = 1.5
CHECK_CACHE_S = 5.0
CHECK_CACHE_MAX = 2000
# Users the local limit keeps history for; the oldest is dropped past this.
LOCAL_USERS_MAX = 10_000
LOCAL_WINDOW_S = 300

log = logging.getLogger("fiscallm")
T = TypeVar("T")

PostFn = Callable[[str, Dict[str, str], bytes], int]


def _http_post(url: str, headers: Dict[str, str], body: bytes) -> int:
    """POSTs and returns the status code; raises on network errors."""
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            return response.status
    except urllib.error.HTTPError as e:
        return e.code


PostJsonFn = Callable[[str, Dict[str, str], bytes], "tuple[int, bytes]"]


def _http_post_json(url: str, headers: Dict[str, str], body: bytes) -> "tuple[int, bytes]":
    """POSTs and returns (status, body); raises on network errors."""
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=CHECK_TIMEOUT_S) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as e:
        return e.code, b""


@dataclass(frozen=True)
class CheckResult:
    """The answer to ``meter.check(user_id)``."""

    allow: bool = True
    #: Why the user is refused, e.g. "daily AI budget reached ($6.00 of $5.00)".
    reason: Optional[str] = None
    spent_today: Optional[float] = None
    spent_30d: Optional[float] = None
    #: "server", "local" (the local limit), "last-known" (FiscaLLM unreachable;
    #: the user was refused before) or "unreachable" (``check_on_error`` decided).
    source: Optional[str] = None


@dataclass(frozen=True)
class LocalLimit:
    """A per-user limit ``check()`` enforces in this process, with no network
    call, from the events this meter tracked. Catches a runaway loop even when
    FiscaLLM is down. ``cost_usd`` counts only events tracked with an exact cost."""

    requests: Optional[int] = None
    tokens: Optional[int] = None
    cost_usd: Optional[float] = None
    window_seconds: float = LOCAL_WINDOW_S


def _window_text(seconds: float) -> str:
    if seconds % 60:
        return "%g seconds" % seconds
    return "1 minute" if seconds == 60 else "%g minutes" % (seconds / 60)


def _count(value: Any) -> int:
    try:
        number = round(float(value))
    except (TypeError, ValueError):
        return 0
    return int(number) if number > 0 else 0


class Meter:
    """Reports AI usage per user to FiscaLLM.

    Create one per process. In serverless functions (AWS Lambda, Google Cloud
    Functions) call ``flush()`` before returning.
    """

    def __init__(
        self,
        api_key: Optional[str],
        *,
        endpoint: str = DEFAULT_ENDPOINT,
        flush_interval: float = INTERVAL_S,
        disabled: Optional[bool] = None,
        check_on_error: str = "allow",
        local_limit: Optional[LocalLimit] = None,
        _post: Optional[PostFn] = None,
        _post_json: Optional[PostJsonFn] = None,
    ) -> None:
        # Kill switch: when disabled the meter does nothing. Defaults to on when
        # the environment variable FISCALLM_DISABLED is "1" or "true".
        if disabled is None:
            disabled = os.environ.get("FISCALLM_DISABLED", "").strip().lower() in ("1", "true")
        self._disabled = bool(disabled)
        self._api_key = api_key
        self._endpoint = endpoint
        self._interval = flush_interval
        self._post = _post or _http_post
        self._post_json = _post_json or _http_post_json
        self._check_cache: Dict[str, "tuple[float, CheckResult]"] = {}
        # What check() answers when FiscaLLM cannot be reached: "allow" or
        # "deny". A user refused earlier stays refused either way.
        self._check_on_error = check_on_error
        self._last_deny: Dict[str, CheckResult] = {}
        self._local_limit = local_limit
        self._recent: Dict[str, List["tuple[float, int, float]"]] = {}
        self._recent_lock = threading.Lock()
        self._queue: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._send_lock = threading.Lock()
        self._wake = threading.Event()
        self._warned: set = set()
        self._closed = False
        self._thread: Optional[threading.Thread] = None
        self._revenue_threads: List[threading.Thread] = []
        if self._disabled:
            return
        if not api_key:
            self._warn_once("no-key", "no api_key given; events are not sent")
        atexit.register(self.flush)

    # ---- public API ----

    def track(
        self,
        *,
        user_id: str,
        provider: str,
        model: str,
        input_tokens: Union[int, float, None] = 0,
        output_tokens: Union[int, float, None] = 0,
        cached_tokens: Union[int, float, None] = 0,
        cache_write_tokens: Union[int, float, None] = 0,
        units: Optional[float] = None,
        unit: Optional[str] = None,
        variant: Optional[str] = None,
        cost_usd: Optional[float] = None,
        feature: Optional[str] = None,
        job_id: Optional[str] = None,
        ts: Optional[datetime] = None,
    ) -> None:
        """Queues one event. ``input_tokens`` excludes cache reads and writes.

        For usage priced per unit, pass ``units`` with ``unit`` ("image",
        "second", "minute" or "character") and optionally a ``variant`` such
        as "1080p". Pass ``cost_usd`` to give the exact cost instead. ``job_id``
        ties the call to a job whose payment you report with ``track_job``."""
        if self._disabled:
            return
        try:
            if user_id:
                cost = float(cost_usd) if isinstance(cost_usd, (int, float)) and cost_usd > 0 else 0.0
                self._note_local(str(user_id), _count(input_tokens) + _count(output_tokens) + _count(cached_tokens) + _count(cache_write_tokens), cost)
            if not self._api_key:
                return
            if not user_id or not provider or not model:
                self._warn_once("invalid", "track() needs user_id, provider and model; event skipped")
                return
            when = ts or datetime.now(timezone.utc)
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            event: Dict[str, Any] = {
                "id": str(uuid.uuid4()),
                "userId": str(user_id),
                "ts": when.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                "provider": provider,
                "model": model,
                "inputTokens": _count(input_tokens),
                "outputTokens": _count(output_tokens),
                "cachedTokens": _count(cached_tokens),
                "cacheWriteTokens": _count(cache_write_tokens),
            }
            if isinstance(units, (int, float)) and units > 0 and unit:
                event["units"] = float(units)
                event["unit"] = unit
                if variant:
                    event["variant"] = str(variant)
            if isinstance(cost_usd, (int, float)) and cost_usd >= 0:
                event["costUsd"] = float(cost_usd)
            if feature:
                event["feature"] = feature
            if job_id:
                event["jobId"] = str(job_id)
            with self._lock:
                self._queue.append(event)
                full = len(self._queue) >= MAX_BATCH
            self._ensure_thread()
            if full:
                self._wake.set()
        except Exception:  # Metering must never break the caller.
            pass

    def track_revenue(
        self,
        *,
        id: str,
        user_id: str,
        type: str,
        product_id: Optional[str] = None,
        amount_usd: Optional[float] = None,
        net_usd: Optional[float] = None,
        tax_pct: Optional[float] = None,
        fee_pct: Optional[float] = None,
        period_end: Optional[datetime] = None,
        is_trial_conversion: Optional[bool] = None,
        one_time: Optional[bool] = None,
        environment: Optional[str] = None,
        ts: Optional[datetime] = None,
    ) -> None:
        """Reports a payment from your own billing system, for apps without
        RevenueCat. ``type`` is trial_started, purchase, renewal, refund,
        cancellation or expiration; ``amount_usd`` is required for purchase,
        renewal and refund. Retries with the same ``id`` are ignored. Sent
        right away on a background thread."""
        if self._disabled:
            return
        try:
            if not self._api_key:
                return
            if not id or not user_id or not type:
                self._warn_once("invalid-revenue", "track_revenue() needs id, user_id and type; event skipped")
                return

            def iso(d: Optional[datetime]) -> Optional[str]:
                if d is None:
                    return None
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                return d.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

            event = {
                "id": str(id),
                "userId": str(user_id),
                "type": type,
                "ts": iso(ts or datetime.now(timezone.utc)),
                "productId": product_id,
                "amountUsd": amount_usd,
                "netUsd": net_usd,
                "taxPct": tax_pct,
                "feePct": fee_pct,
                "periodEnd": iso(period_end),
                "isTrialConversion": is_trial_conversion,
                "oneTime": one_time,
                "environment": environment,
            }
            event = {k: v for k, v in event.items() if v is not None}
            url = self._endpoint[: -len("/events")] + "/revenue" if self._endpoint.endswith("/events") else self._endpoint
            t = threading.Thread(target=self._send, args=([event], url), name="fiscallm-revenue", daemon=True)
            t.start()
            self._revenue_threads = [x for x in self._revenue_threads if x.is_alive()] + [t]
        except Exception:
            pass

    def track_job(self, *, job_id: str, user_id: str, status: str, ts: Optional[datetime] = None) -> None:
        """Reports what happened to the user's payment (or credits) for a job:
        "pending" (held, outcome not known yet, e.g. the provider timed out),
        "captured" (charged) or "refunded" (given back). Send it each time the
        status changes; the newest report wins, and "pending" never reopens a
        captured or refunded job. Sent right away on a background thread."""
        if self._disabled:
            return
        try:
            if not self._api_key:
                return
            if not job_id or not user_id or status not in ("pending", "captured", "refunded"):
                self._warn_once("invalid-job", "track_job() needs job_id, user_id and a status of pending, captured or refunded; skipped")
                return
            when = ts or datetime.now(timezone.utc)
            if when.tzinfo is None:
                when = when.replace(tzinfo=timezone.utc)
            job = {
                "jobId": str(job_id),
                "userId": str(user_id),
                "status": status,
                "ts": when.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            url = self._endpoint[: -len("/events")] + "/jobs" if self._endpoint.endswith("/events") else self._endpoint
            t = threading.Thread(target=self._send, args=([job], url, "jobs"), name="fiscallm-job", daemon=True)
            t.start()
            self._revenue_threads = [x for x in self._revenue_threads if x.is_alive()] + [t]
        except Exception:
            pass

    def track_openai(self, response: Any, *, user_id: str, feature: Optional[str] = None, provider: Optional[str] = None, model: Optional[str] = None, job_id: Optional[str] = None) -> None:
        """A Chat Completions or Responses API result, from the SDK or ``r.json()``.
        Set ``provider`` for OpenAI-compatible APIs such as Groq or OpenRouter."""
        self._track_usage(self._safe(from_openai, response), "track_openai", user_id, feature, provider, model, job_id)

    def track_anthropic(self, response: Any, *, user_id: str, feature: Optional[str] = None, model: Optional[str] = None, job_id: Optional[str] = None) -> None:
        """A Messages API result."""
        self._track_usage(self._safe(from_anthropic, response), "track_anthropic", user_id, feature, None, model, job_id)

    def track_gemini(self, response: Any, *, user_id: str, feature: Optional[str] = None, model: Optional[str] = None, job_id: Optional[str] = None) -> None:
        """A ``generate_content`` result from google-genai, or the REST JSON."""
        self._track_usage(self._safe(from_gemini, response), "track_gemini", user_id, feature, None, model, job_id)

    def track_stream(self, stream: Any, *, user_id: str, feature: Optional[str] = None, provider: Optional[str] = None, model: Optional[str] = None, job_id: Optional[str] = None) -> Any:
        """Wraps a streamed result; chunks pass through unchanged and usage is
        recorded when the stream ends. Works for sync and async iterables.
        OpenAI Chat Completions needs ``stream_options={"include_usage": True}``."""
        if self._disabled:
            return stream
        if hasattr(stream, "__aiter__"):
            return self._wrap_async(stream, user_id, feature, provider, model, job_id)
        return self._wrap_sync(stream, user_id, feature, provider, model, job_id)

    def check(self, user_id: str) -> CheckResult:
        """May this user make another AI call?

        Call it before the AI call and, when ``allow`` is False, refuse or switch
        to a cheaper model. The ``local_limit`` is checked first, in
        process. If FiscaLLM is slow or down, a user it refused before stays
        refused; anyone else gets ``check_on_error`` ("allow" by default).
        Never raises.
        """
        open_ = CheckResult()
        if self._disabled or not user_id:
            return open_
        uid = str(user_id)

        def fallback() -> CheckResult:
            last = self._last_deny.get(uid)
            if last is not None:
                return CheckResult(allow=False, reason=last.reason, spent_today=last.spent_today, spent_30d=last.spent_30d, source="last-known")
            if self._check_on_error == "deny":
                return CheckResult(allow=False, reason="FiscaLLM unreachable; check_on_error is deny", source="unreachable")
            return CheckResult(allow=True, source="unreachable")

        try:
            local = self._local_refusal(uid)
            if local is not None:
                return local
            if not self._api_key:
                return open_
            hit = self._check_cache.get(uid)
            if hit and time.monotonic() - hit[0] < CHECK_CACHE_S:
                return hit[1]
            url = self._endpoint[: -len("/events")] + "/check" if self._endpoint.endswith("/events") else self._endpoint
            status, raw = self._post_json(url, {"content-type": "application/json", "authorization": "Bearer " + self._api_key}, json.dumps({"userId": uid}).encode())
            if status != 200:
                if status in (401, 403):
                    self._warn_once("check-%d" % status, "check() was refused (%d); check the ingest key. Using check_on_error." % status)
                return fallback()
            data = json.loads(raw)
            result = CheckResult(
                allow=data.get("allow") is not False,
                reason=data["reason"] if isinstance(data.get("reason"), str) else None,
                spent_today=data["spentToday"] if isinstance(data.get("spentToday"), (int, float)) else None,
                spent_30d=data["spent30d"] if isinstance(data.get("spent30d"), (int, float)) else None,
                source="server",
            )
            if len(self._check_cache) >= CHECK_CACHE_MAX:
                self._check_cache.clear()
            self._check_cache[uid] = (time.monotonic(), result)
            if result.allow:
                self._last_deny.pop(uid, None)
            else:
                if len(self._last_deny) >= CHECK_CACHE_MAX:
                    self._last_deny.clear()
                self._last_deny[uid] = result
            return result
        except Exception:
            return fallback()

    async def acheck(self, user_id: str) -> CheckResult:
        """``check()`` for async code, run off the event loop."""
        import asyncio

        return await asyncio.get_running_loop().run_in_executor(None, self.check, user_id)

    def flush(self) -> None:
        """Sends everything queued, waiting at most a few seconds. Never raises."""
        if self._disabled:
            return
        try:
            self._send_all()
            for t in list(self._revenue_threads):
                t.join(timeout=2 * TIMEOUT_S + RETRY_DELAY_S)
        except Exception:
            pass

    async def aflush(self) -> None:
        """``flush()`` for async code, run off the event loop."""
        import asyncio

        await asyncio.get_running_loop().run_in_executor(None, self.flush)

    # ---- internals ----

    def _wrap_sync(self, stream: Iterable[T], user_id: str, feature: Optional[str], provider: Optional[str], model: Optional[str], job_id: Optional[str] = None) -> Iterator[T]:
        acc = StreamUsage()
        try:
            for chunk in stream:
                try:
                    acc.add(chunk)
                except Exception:
                    pass
                yield chunk
        finally:
            # Also runs when the caller stops early; partial usage is still
            # the best estimate of what was billed.
            self._finish_stream(acc, user_id, feature, provider, model, job_id)

    async def _wrap_async(self, stream: AsyncIterable[T], user_id: str, feature: Optional[str], provider: Optional[str], model: Optional[str], job_id: Optional[str] = None) -> AsyncIterator[T]:
        acc = StreamUsage()
        try:
            async for chunk in stream:
                try:
                    acc.add(chunk)
                except Exception:
                    pass
                yield chunk
        finally:
            self._finish_stream(acc, user_id, feature, provider, model, job_id)

    def _finish_stream(self, acc: StreamUsage, user_id: str, feature: Optional[str], provider: Optional[str], model: Optional[str], job_id: Optional[str] = None) -> None:
        try:
            if acc.missing_openai_usage:
                self._warn_once("include-usage", 'OpenAI stream had no usage; pass stream_options={"include_usage": True}')
                return
            self._track_usage(acc.usage, "track_stream", user_id, feature, provider, model, job_id)
        except Exception:
            pass

    def _safe(self, fn: Callable[[Any], Optional[Usage]], response: Any) -> Optional[Usage]:
        try:
            return fn(response)
        except Exception:
            return None

    def _track_usage(self, usage: Optional[Usage], source: str, user_id: str, feature: Optional[str], provider: Optional[str], model: Optional[str], job_id: Optional[str] = None) -> None:
        if self._disabled:
            return
        if usage is None:
            self._warn_once(f"no-usage-{source}", f"{source}: no token usage found in the response; event skipped")
            return
        self.track(
            user_id=user_id,
            provider=provider or usage.provider,
            model=model or usage.model,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cached_tokens=usage.cached_tokens,
            cache_write_tokens=usage.cache_write_tokens,
            feature=feature,
            job_id=job_id,
        )

    def _recent_for(self, uid: str, now: float) -> List["tuple[float, int, float]"]:
        window = self._local_limit.window_seconds if self._local_limit else LOCAL_WINDOW_S
        items = [e for e in self._recent.get(uid, []) if now - e[0] < window]
        if items:
            self._recent[uid] = items
        else:
            self._recent.pop(uid, None)
        return items

    def _note_local(self, uid: str, tokens: int, cost: float) -> None:
        if self._local_limit is None:
            return
        with self._recent_lock:
            now = time.monotonic()
            items = self._recent_for(uid, now)
            items.append((now, tokens, cost))
            # Re-insert so dict order is least recently used first.
            self._recent.pop(uid, None)
            self._recent[uid] = items
            if len(self._recent) > LOCAL_USERS_MAX:
                self._recent.pop(next(iter(self._recent)))

    def _local_refusal(self, uid: str) -> Optional[CheckResult]:
        limit = self._local_limit
        if limit is None:
            return None
        with self._recent_lock:
            items = list(self._recent_for(uid, time.monotonic()))
        window = _window_text(limit.window_seconds)
        tokens = sum(e[1] for e in items)
        cost = sum(e[2] for e in items)
        reason = None
        if limit.requests is not None and len(items) >= limit.requests:
            reason = "local limit: %d AI calls in %s" % (len(items), window)
        elif limit.tokens is not None and tokens >= limit.tokens:
            reason = "local limit: %d tokens in %s" % (tokens, window)
        elif limit.cost_usd is not None and cost >= limit.cost_usd:
            reason = "local limit: $%.2f in %s" % (cost, window)
        return CheckResult(allow=False, reason=reason, source="local") if reason else None

    def _warn_once(self, key: str, message: str) -> None:
        if key in self._warned:
            return
        self._warned.add(key)
        try:
            log.warning("[fiscallm] %s", message)
        except Exception:
            pass

    def _ensure_thread(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            # Daemon: never keeps the process alive; atexit flushes the rest.
            self._thread = threading.Thread(target=self._run, name="fiscallm", daemon=True)
            self._thread.start()

    def _run(self) -> None:
        while not self._closed:
            self._wake.wait(self._interval)
            self._wake.clear()
            try:
                self._send_all()
            except Exception:
                pass

    def _send_all(self) -> None:
        with self._send_lock:
            while True:
                with self._lock:
                    batch, self._queue = self._queue[:MAX_BATCH], self._queue[MAX_BATCH:]
                if not batch:
                    return
                self._send(batch)

    def _send(self, batch: List[Dict[str, Any]], url: Optional[str] = None, field: str = "events") -> None:
        url = url or self._endpoint
        body = json.dumps({field: batch}).encode()
        headers = {"content-type": "application/json", "authorization": f"Bearer {self._api_key}", "user-agent": "fiscallm-python/0.6.0"}
        for attempt in range(2):
            try:
                status = self._post(url, headers, body)
            except Exception:
                status = 0
            if 200 <= status < 300:
                return
            if status and status != 429 and status < 500:
                self._warn_once(f"http-{status}", f"events rejected ({status}); check the api_key, or you may have reached the monthly event limit")
                return
            if attempt == 0:
                time.sleep(RETRY_DELAY_S)
        self._warn_once("unreachable", f"could not reach {url}; {len(batch)} events dropped")
