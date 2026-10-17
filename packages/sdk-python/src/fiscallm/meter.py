"""The FiscaLLM meter. Standard library only.

Tracking calls only queue an event; a background thread sends batches. The
meter never raises and never blocks the caller, except ``flush()``.
"""

from __future__ import annotations

import atexit
import json
import logging
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterable, AsyncIterator, Callable, Dict, Iterable, Iterator, List, Optional, TypeVar, Union

from .usage import StreamUsage, Usage, from_anthropic, from_gemini, from_openai

DEFAULT_ENDPOINT = "https://fiscallm.com/api/v1/events"
MAX_BATCH = 100
TIMEOUT_S = 2.0
RETRY_DELAY_S = 0.25
INTERVAL_S = 2.0

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
        _post: Optional[PostFn] = None,
    ) -> None:
        self._api_key = api_key
        self._endpoint = endpoint
        self._interval = flush_interval
        self._post = _post or _http_post
        self._queue: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._send_lock = threading.Lock()
        self._wake = threading.Event()
        self._warned: set = set()
        self._closed = False
        self._thread: Optional[threading.Thread] = None
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
        cost_usd: Optional[float] = None,
        feature: Optional[str] = None,
        ts: Optional[datetime] = None,
    ) -> None:
        """Queues one event. ``input_tokens`` excludes cache reads and writes.
        Pass ``cost_usd`` for calls not priced per token (images, voice)."""
        try:
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
            if isinstance(cost_usd, (int, float)) and cost_usd >= 0:
                event["costUsd"] = float(cost_usd)
            if feature:
                event["feature"] = feature
            with self._lock:
                self._queue.append(event)
                full = len(self._queue) >= MAX_BATCH
            self._ensure_thread()
            if full:
                self._wake.set()
        except Exception:  # Metering must never break the caller.
            pass

    def track_openai(self, response: Any, *, user_id: str, feature: Optional[str] = None, provider: Optional[str] = None, model: Optional[str] = None) -> None:
        """A Chat Completions or Responses API result, from the SDK or ``r.json()``.
        Set ``provider`` for OpenAI-compatible APIs such as Groq or OpenRouter."""
        self._track_usage(self._safe(from_openai, response), "track_openai", user_id, feature, provider, model)

    def track_anthropic(self, response: Any, *, user_id: str, feature: Optional[str] = None, model: Optional[str] = None) -> None:
        """A Messages API result."""
        self._track_usage(self._safe(from_anthropic, response), "track_anthropic", user_id, feature, None, model)

    def track_gemini(self, response: Any, *, user_id: str, feature: Optional[str] = None, model: Optional[str] = None) -> None:
        """A ``generate_content`` result from google-genai, or the REST JSON."""
        self._track_usage(self._safe(from_gemini, response), "track_gemini", user_id, feature, None, model)

    def track_stream(self, stream: Any, *, user_id: str, feature: Optional[str] = None, provider: Optional[str] = None, model: Optional[str] = None) -> Any:
        """Wraps a streamed result; chunks pass through unchanged and usage is
        recorded when the stream ends. Works for sync and async iterables.
        OpenAI Chat Completions needs ``stream_options={"include_usage": True}``."""
        if hasattr(stream, "__aiter__"):
            return self._wrap_async(stream, user_id, feature, provider, model)
        return self._wrap_sync(stream, user_id, feature, provider, model)

    def flush(self) -> None:
        """Sends everything queued, waiting at most a few seconds. Never raises."""
        try:
            self._send_all()
        except Exception:
            pass

    async def aflush(self) -> None:
        """``flush()`` for async code, run off the event loop."""
        import asyncio

        await asyncio.get_running_loop().run_in_executor(None, self.flush)

    # ---- internals ----

    def _wrap_sync(self, stream: Iterable[T], user_id: str, feature: Optional[str], provider: Optional[str], model: Optional[str]) -> Iterator[T]:
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
            self._finish_stream(acc, user_id, feature, provider, model)

    async def _wrap_async(self, stream: AsyncIterable[T], user_id: str, feature: Optional[str], provider: Optional[str], model: Optional[str]) -> AsyncIterator[T]:
        acc = StreamUsage()
        try:
            async for chunk in stream:
                try:
                    acc.add(chunk)
                except Exception:
                    pass
                yield chunk
        finally:
            self._finish_stream(acc, user_id, feature, provider, model)

    def _finish_stream(self, acc: StreamUsage, user_id: str, feature: Optional[str], provider: Optional[str], model: Optional[str]) -> None:
        try:
            if acc.missing_openai_usage:
                self._warn_once("include-usage", 'OpenAI stream had no usage; pass stream_options={"include_usage": True}')
                return
            self._track_usage(acc.usage, "track_stream", user_id, feature, provider, model)
        except Exception:
            pass

    def _safe(self, fn: Callable[[Any], Optional[Usage]], response: Any) -> Optional[Usage]:
        try:
            return fn(response)
        except Exception:
            return None

    def _track_usage(self, usage: Optional[Usage], source: str, user_id: str, feature: Optional[str], provider: Optional[str], model: Optional[str]) -> None:
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
        )

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

    def _send(self, batch: List[Dict[str, Any]]) -> None:
        body = json.dumps({"events": batch}).encode()
        headers = {"content-type": "application/json", "authorization": f"Bearer {self._api_key}", "user-agent": "fiscallm-python/0.1.0"}
        for attempt in range(2):
            try:
                status = self._post(self._endpoint, headers, body)
            except Exception:
                status = 0
            if 200 <= status < 300:
                return
            if status and status != 429 and status < 500:
                self._warn_once(f"http-{status}", f"events rejected ({status}); check the api_key")
                return
            if attempt == 0:
                time.sleep(RETRY_DELAY_S)
        self._warn_once("unreachable", f"could not reach {self._endpoint}; {len(batch)} events dropped")
