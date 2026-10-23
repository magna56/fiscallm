"""Track the AI cost of each user against their subscription revenue.

    from fiscallm import Meter

    meter = Meter(api_key=os.environ["FISCALLM_KEY"])
    meter.track_openai(response, user_id=revenuecat_app_user_id, feature="chat")
"""

from .meter import DEFAULT_ENDPOINT, MAX_BATCH, CheckResult, LocalLimit, Meter
from .usage import StreamUsage, Usage, from_anthropic, from_gemini, from_openai

__all__ = ["Meter", "CheckResult", "LocalLimit", "Usage", "StreamUsage", "from_openai", "from_anthropic", "from_gemini", "DEFAULT_ENDPOINT", "MAX_BATCH"]
__version__ = "0.6.0"
