"""A FastAPI endpoint that answers a chat message with OpenAI and reports the
cost to FiscaLLM.

    pip install -r requirements.txt
    export OPENAI_API_KEY=... FISCALLM_KEY=...   # ingest key from your app's Setup page
    uvicorn main:app --reload

Self-hosting? Also set FISCALLM_ENDPOINT, e.g. https://your-domain/api/v1/events.
"""

import os

from fastapi import FastAPI
from fiscallm import Meter
from openai import OpenAI
from pydantic import BaseModel

app = FastAPI()
client = OpenAI()  # reads OPENAI_API_KEY

# One meter per process. It sends in the background and never raises.
meter = Meter(
    api_key=os.environ.get("FISCALLM_KEY"),
    endpoint=os.environ.get("FISCALLM_ENDPOINT", "https://fiscallm.com/api/v1/events"),
)


class ChatIn(BaseModel):
    message: str
    # In a real app take this from your own session (your auth), not from the request.
    # If you use RevenueCat it must be the RevenueCat app user ID, so costs line up with payments.
    user_id: str


@app.post("/chat")
def chat(body: ChatIn):
    res = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": body.message}])

    # The one line FiscaLLM needs. It reads only the model name and token counts, never the text.
    meter.track_openai(res, user_id=body.user_id, feature="chat")

    return {"reply": res.choices[0].message.content or ""}
