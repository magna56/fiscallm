import asyncio
import json
import os
import sys
import unittest
from types import SimpleNamespace as NS

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from fiscallm import Meter  # noqa: E402


class Recorder:
    """Stands in for the HTTP POST: records batches, returns queued statuses."""

    def __init__(self, *statuses):
        self.statuses = list(statuses)
        self.calls = []

    def __call__(self, url, headers, body):
        self.calls.append((url, headers, json.loads(body)["events"]))
        status = self.statuses.pop(0) if self.statuses else 202
        if isinstance(status, Exception):
            raise status
        return status

    @property
    def events(self):
        return [e for _, _, batch in self.calls for e in batch]


def meter(rec, **kw):
    return Meter(api_key="k", flush_interval=60, _post=rec, **kw)


class HelpersTest(unittest.TestCase):
    def test_openai_chat_object_takes_cached_out_of_input(self):
        rec = Recorder()
        m = meter(rec)
        res = NS(model="gpt-4o-2024-08-06", usage=NS(prompt_tokens=1000, completion_tokens=200, prompt_tokens_details=NS(cached_tokens=300, cache_write_tokens=100)))
        m.track_openai(res, user_id="u1", feature="chat")
        m.flush()
        e = rec.events[0]
        self.assertEqual((e["provider"], e["model"], e["inputTokens"], e["cachedTokens"], e["cacheWriteTokens"], e["outputTokens"]), ("openai", "gpt-4o-2024-08-06", 600, 300, 100, 200))
        self.assertEqual((e["userId"], e["feature"]), ("u1", "chat"))
        self.assertEqual(len(e["id"]), 36)

    def test_openai_responses_dict(self):
        rec = Recorder()
        m = meter(rec)
        m.track_openai({"model": "gpt-5.4", "usage": {"input_tokens": 500, "input_tokens_details": {"cached_tokens": 100}, "output_tokens": 80}}, user_id="u")
        m.flush()
        self.assertEqual(rec.events[0]["inputTokens"], 400)

    def test_compatible_provider_name(self):
        rec = Recorder()
        m = meter(rec)
        m.track_openai({"model": "llama-4", "usage": {"prompt_tokens": 10, "completion_tokens": 2}}, user_id="u", provider="groq")
        m.flush()
        self.assertEqual(rec.events[0]["provider"], "groq")

    def test_anthropic_cache_fields(self):
        rec = Recorder()
        m = meter(rec)
        m.track_anthropic(NS(model="claude-opus-5-5", usage=NS(input_tokens=50, cache_creation_input_tokens=2000, cache_read_input_tokens=8000, output_tokens=400)), user_id="u")
        m.flush()
        e = rec.events[0]
        self.assertEqual((e["inputTokens"], e["cacheWriteTokens"], e["cachedTokens"], e["outputTokens"]), (50, 2000, 8000, 400))

    def test_gemini_snake_and_camel_case(self):
        rec = Recorder()
        m = meter(rec)
        sdk = NS(model_version="gemini-2.5-flash", usage_metadata=NS(prompt_token_count=1000, cached_content_token_count=600, tool_use_prompt_token_count=50, candidates_token_count=100, thoughts_token_count=300))
        rest = {"modelVersion": "gemini-2.5-flash", "usageMetadata": {"promptTokenCount": 1000, "cachedContentTokenCount": 600, "toolUsePromptTokenCount": 50, "candidatesTokenCount": 100, "thoughtsTokenCount": 300}}
        m.track_gemini(sdk, user_id="u")
        m.track_gemini(rest, user_id="u")
        m.flush()
        for e in rec.events:
            self.assertEqual((e["provider"], e["inputTokens"], e["cachedTokens"], e["outputTokens"]), ("google", 450, 600, 400))

    def test_missing_usage_is_skipped_with_one_warning(self):
        rec = Recorder()
        m = meter(rec)
        with self.assertLogs("fiscallm", "WARNING") as logs:
            m.track_openai({"model": "x"}, user_id="u")
            m.track_openai(None, user_id="u")
        m.flush()
        self.assertEqual(rec.events, [])
        self.assertEqual(len(logs.output), 1)

    def test_track_cost_and_cleanup(self):
        rec = Recorder()
        m = meter(rec)
        m.track(user_id="u", provider="fal", model="flux", cost_usd=0.04, input_tokens=-5, output_tokens=2.6)
        m.track(user_id="", provider="x", model="y")
        m.flush()
        self.assertEqual(len(rec.events), 1)
        e = rec.events[0]
        self.assertEqual((e["costUsd"], e["inputTokens"], e["outputTokens"]), (0.04, 0, 3))
        self.assertTrue(e["ts"].endswith("Z"))


ANTHROPIC_STREAM = [
    {"type": "message_start", "message": {"model": "claude-opus-5-5", "usage": {"input_tokens": 2679, "output_tokens": 3}}},
    {"type": "content_block_delta", "delta": {"text": "hi"}},
    {"type": "message_delta", "usage": {"input_tokens": 10682, "cache_read_input_tokens": 500, "output_tokens": 510}},
    {"type": "message_stop"},
]


class UnitsTest(unittest.TestCase):
    def test_units_unit_and_variant(self):
        rec = Recorder()
        m = meter(rec)
        m.track(user_id="u", provider="google", model="veo-3.1-fast-generate-preview", units=8, unit="second", variant="1080p")
        m.track(user_id="u", provider="openai", model="whisper-1", unit="minute")
        m.flush()
        self.assertEqual((rec.events[0]["units"], rec.events[0]["unit"], rec.events[0]["variant"]), (8.0, "second", "1080p"))
        self.assertNotIn("unit", rec.events[1])


class RevenueTest(unittest.TestCase):
    def test_sends_revenue_to_its_endpoint(self):
        from datetime import datetime, timezone

        rec = Recorder()
        m = meter(rec)
        m.track_revenue(id="inv_1", user_id="u", type="renewal", amount_usd=9.99, fee_pct=0.15, period_end=datetime(2026, 11, 17, tzinfo=timezone.utc))
        m.flush()
        url, _, batch = rec.calls[0]
        self.assertEqual(url, "https://fiscallm.com/api/v1/revenue")
        self.assertEqual(batch[0]["periodEnd"], "2026-11-17T00:00:00Z")
        self.assertEqual((batch[0]["amountUsd"], batch[0]["feePct"]), (9.99, 0.15))
        self.assertNotIn("netUsd", batch[0])


class StreamTest(unittest.TestCase):
    def test_sync_stream_passes_chunks_and_reads_cumulative_usage(self):
        rec = Recorder()
        m = meter(rec)
        seen = list(m.track_stream(iter(ANTHROPIC_STREAM), user_id="u"))
        m.flush()
        self.assertEqual(seen, ANTHROPIC_STREAM)
        e = rec.events[0]
        self.assertEqual((e["inputTokens"], e["cachedTokens"], e["outputTokens"]), (10682, 500, 510))

    def test_async_stream(self):
        rec = Recorder()
        m = meter(rec)

        async def gen():
            yield NS(object="chat.completion.chunk", model="gpt-4o-mini", choices=[NS()], usage=None)
            yield NS(object="chat.completion.chunk", model="gpt-4o-mini", choices=[], usage=NS(prompt_tokens=12, completion_tokens=3))

        async def run():
            return [c async for c in m.track_stream(gen(), user_id="u")]

        chunks = asyncio.run(run())
        m.flush()
        self.assertEqual(len(chunks), 2)
        self.assertEqual((rec.events[0]["inputTokens"], rec.events[0]["outputTokens"]), (12, 3))

    def test_openai_stream_without_usage_warns(self):
        rec = Recorder()
        m = meter(rec)
        with self.assertLogs("fiscallm", "WARNING") as logs:
            list(m.track_stream(iter([{"object": "chat.completion.chunk", "model": "m", "choices": []}]), user_id="u"))
        m.flush()
        self.assertEqual(rec.events, [])
        self.assertIn("include_usage", logs.output[0])

    def test_responses_and_gemini_streams(self):
        rec = Recorder()
        m = meter(rec)
        list(m.track_stream(iter([{"type": "response.output_text.delta"}, {"type": "response.completed", "response": {"model": "gpt-5.4", "usage": {"input_tokens": 40, "output_tokens": 9}}}]), user_id="u"))
        list(m.track_stream(iter([NS(candidates=[1], model_version="gemini-2.5-pro", usage_metadata=NS(prompt_token_count=30, candidates_token_count=1)), NS(candidates=[1], model_version="gemini-2.5-pro", usage_metadata=NS(prompt_token_count=30, candidates_token_count=90))]), user_id="u"))
        m.flush()
        self.assertEqual([(e["model"], e["outputTokens"]) for e in rec.events], [("gpt-5.4", 9), ("gemini-2.5-pro", 90)])

    def test_early_stop_still_records(self):
        rec = Recorder()
        m = meter(rec)
        for c in m.track_stream(iter(ANTHROPIC_STREAM), user_id="u"):
            if c["type"] == "content_block_delta":
                break
        m.flush()
        self.assertEqual(rec.events[0]["outputTokens"], 3)


class SendingTest(unittest.TestCase):
    def test_batches_of_100(self):
        rec = Recorder()
        m = meter(rec)
        for _ in range(250):
            m.track(user_id="u", provider="openai", model="gpt-4o", input_tokens=1)
        m.flush()
        # The thread may start sending at 100 while more are queued, so only
        # the limits are fixed: no batch over 100, every event sent once.
        sizes = [len(b) for _, _, b in rec.calls]
        self.assertLessEqual(max(sizes), 100)
        self.assertEqual(sum(sizes), 250)
        self.assertEqual(len({e["id"] for e in rec.events}), 250)
        url, headers, _ = rec.calls[0]
        self.assertEqual(url, "https://fiscallm.com/api/v1/events")
        self.assertEqual(headers["authorization"], "Bearer k")

    def test_retries_once_with_the_same_ids(self):
        rec = Recorder(OSError("down"), 202)
        m = meter(rec)
        m.track(user_id="u", provider="openai", model="gpt-4o")
        m.flush()
        self.assertEqual(len(rec.calls), 2)
        self.assertEqual(rec.calls[0][2][0]["id"], rec.calls[1][2][0]["id"])

    def test_gives_up_after_retry_and_does_not_retry_4xx(self):
        rec = Recorder(500, 503, 401)
        m = meter(rec)
        with self.assertLogs("fiscallm", "WARNING"):
            m.track(user_id="u", provider="openai", model="gpt-4o")
            m.flush()
            m.track(user_id="u", provider="openai", model="gpt-4o")
            m.flush()
        self.assertEqual(len(rec.calls), 3)

    def test_never_raises_even_if_post_raises(self):
        def boom(*_):
            raise RuntimeError("boom")

        m = Meter(api_key="k", flush_interval=60, _post=boom)
        m.track(user_id="u", provider="openai", model="gpt-4o")
        m.flush()

    def test_background_thread_sends_on_interval(self):
        rec = Recorder()
        m = Meter(api_key="k", flush_interval=0.05, _post=rec)
        m.track(user_id="u", provider="openai", model="gpt-4o")
        import time

        for _ in range(40):
            if rec.calls:
                break
            time.sleep(0.05)
        self.assertEqual(len(rec.events), 1)

    def test_no_key_is_a_no_op(self):
        rec = Recorder()
        with self.assertLogs("fiscallm", "WARNING"):
            m = Meter(api_key=None, _post=rec)
        m.track(user_id="u", provider="openai", model="gpt-4o")
        m.flush()
        self.assertEqual(rec.calls, [])


class KillSwitchTest(unittest.TestCase):
    def test_disabled_meter_sends_nothing_and_passes_streams_through(self):
        rec = Recorder()
        m = meter(rec, disabled=True)
        m.track(user_id="u1", provider="openai", model="gpt-4o", input_tokens=10, output_tokens=5)
        m.track_openai(NS(model="gpt-4o", usage=NS(prompt_tokens=5, completion_tokens=2)), user_id="u1")
        m.track_revenue(id="p1", user_id="u1", type="purchase", amount_usd=5)
        source = iter([1, 2, 3])
        self.assertIs(m.track_stream(source, user_id="u1"), source)
        m.flush()
        self.assertEqual(rec.calls, [])

    def test_environment_variable_switches_it_off_and_the_argument_wins(self):
        os.environ["FISCALLM_DISABLED"] = "1"
        try:
            rec = Recorder()
            m = meter(rec)
            m.track(user_id="u1", provider="openai", model="gpt-4o", input_tokens=1)
            m.flush()
            self.assertEqual(rec.calls, [])

            rec2 = Recorder()
            m2 = meter(rec2, disabled=False)
            m2.track(user_id="u1", provider="openai", model="gpt-4o", input_tokens=1)
            m2.flush()
            self.assertEqual(len(rec2.events), 1)
        finally:
            del os.environ["FISCALLM_DISABLED"]


if __name__ == "__main__":
    unittest.main()
