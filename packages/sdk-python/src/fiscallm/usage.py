"""Reads token usage from provider responses by shape, without importing any
provider SDK. Works with SDK objects (OpenAI, Anthropic, google-genai) and with
plain dicts from ``response.json()``.

Our convention: input_tokens excludes cache reads and cache writes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class Usage:
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cached_tokens: int
    cache_write_tokens: int


def _get(obj: Any, *names: str) -> Any:
    """First present attribute or key among ``names``."""
    if obj is None:
        return None
    for name in names:
        if isinstance(obj, dict):
            if name in obj and obj[name] is not None:
                return obj[name]
        else:
            value = getattr(obj, name, None)
            if value is not None:
                return value
    return None


def _n(value: Any) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return 0
    return number if number > 0 else 0


def _openai_usage(model: str, u: Any) -> Usage:
    total = _n(_get(u, "prompt_tokens", "input_tokens"))
    details = _get(u, "prompt_tokens_details", "input_tokens_details")
    cached = _n(_get(details, "cached_tokens"))
    written = _n(_get(details, "cache_write_tokens"))
    return Usage(
        provider="openai",
        model=model,
        input_tokens=max(0, total - cached - written),
        # Includes reasoning tokens, which are billed as output.
        output_tokens=_n(_get(u, "completion_tokens", "output_tokens")),
        cached_tokens=cached,
        cache_write_tokens=written,
    )


def _anthropic_usage(model: str, u: Any) -> Usage:
    return Usage(
        provider="anthropic",
        model=model,
        input_tokens=_n(_get(u, "input_tokens")),
        output_tokens=_n(_get(u, "output_tokens")),
        cached_tokens=_n(_get(u, "cache_read_input_tokens")),
        cache_write_tokens=_n(_get(u, "cache_creation_input_tokens")),
    )


def _gemini_usage(model: str, u: Any) -> Usage:
    cached = _n(_get(u, "cached_content_token_count", "cachedContentTokenCount"))
    prompt = _n(_get(u, "prompt_token_count", "promptTokenCount"))
    tool = _n(_get(u, "tool_use_prompt_token_count", "toolUsePromptTokenCount"))
    return Usage(
        provider="google",
        model=model,
        # The prompt count includes the cached part.
        input_tokens=max(0, prompt - cached) + tool,
        # Thinking tokens are billed at the output price.
        output_tokens=_n(_get(u, "candidates_token_count", "candidatesTokenCount"))
        + _n(_get(u, "thoughts_token_count", "thoughtsTokenCount")),
        cached_tokens=cached,
        cache_write_tokens=0,
    )


def from_openai(res: Any) -> Optional[Usage]:
    usage = _get(res, "usage")
    return None if usage is None else _openai_usage(str(_get(res, "model") or ""), usage)


def from_anthropic(res: Any) -> Optional[Usage]:
    usage = _get(res, "usage")
    return None if usage is None else _anthropic_usage(str(_get(res, "model") or ""), usage)


def from_gemini(res: Any) -> Optional[Usage]:
    usage = _get(res, "usage_metadata", "usageMetadata")
    return None if usage is None else _gemini_usage(str(_get(res, "model_version", "modelVersion") or ""), usage)


class StreamUsage:
    """Collects usage from streamed chunks of any of the three providers."""

    def __init__(self) -> None:
        self.kind: Optional[str] = None
        self.model = ""
        self.raw: Any = None
        self._anthropic: dict = {}

    @property
    def missing_openai_usage(self) -> bool:
        return self.kind == "openai" and self.raw is None

    def add(self, chunk: Any) -> None:
        kind = _get(chunk, "type")
        kind = kind if isinstance(kind, str) else ""

        # Anthropic: message_start has the input; message_delta has
        # cumulative totals that can also update the input counts.
        if kind == "message_start":
            message = _get(chunk, "message")
            self.kind = "anthropic"
            self.model = str(_get(message, "model") or self.model)
            self._merge(_get(message, "usage"))
            return
        if kind == "message_delta":
            self.kind = "anthropic"
            self._merge(_get(chunk, "usage"))
            return

        # OpenAI Responses API: response.completed and friends.
        if kind.startswith("response.") and _get(chunk, "response") is not None:
            response = _get(chunk, "response")
            self.kind = "openai"
            self.model = str(_get(response, "model") or self.model)
            if _get(response, "usage") is not None:
                self.raw = _get(response, "usage")
            return

        # OpenAI Chat Completions: usage on the last chunk with include_usage.
        if _get(chunk, "object") == "chat.completion.chunk" or _get(chunk, "choices") is not None:
            self.kind = "openai"
            self.model = str(_get(chunk, "model") or self.model)
            if _get(chunk, "usage") is not None:
                self.raw = _get(chunk, "usage")
            return

        # Gemini: each chunk may carry usage metadata; the last is final.
        metadata = _get(chunk, "usage_metadata", "usageMetadata")
        if metadata is not None or _get(chunk, "candidates") is not None:
            self.kind = "google"
            self.model = str(_get(chunk, "model_version", "modelVersion") or self.model)
            if metadata is not None:
                self.raw = metadata

    def _merge(self, usage: Any) -> None:
        if usage is None:
            return
        fields = ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
        for field in fields:
            value = _get(usage, field)
            if value is not None:
                self._anthropic[field] = value
        self.raw = self._anthropic

    @property
    def usage(self) -> Optional[Usage]:
        if self.kind is None or self.raw is None:
            return None
        if self.kind == "anthropic":
            return _anthropic_usage(self.model, self.raw)
        if self.kind == "google":
            return _gemini_usage(self.model, self.raw)
        return _openai_usage(self.model, self.raw)
