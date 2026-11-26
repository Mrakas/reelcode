"""Model calls through any OpenAI-compatible chat API (OpenAI, Azure, OpenRouter, vLLM, ...).

Set OPENAI_API_KEY (and OPENAI_BASE_URL for a non-OpenAI endpoint), or pass api_key / base_url.
"""
from __future__ import annotations

import base64
import json
import os
import re
import time
from pathlib import Path


class LLM:
    def __init__(self, model: str, base_url: str | None = None, api_key: str | None = None, max_tokens: int | None = None,
                 timeout: float = 1800, retries: int = 4, extra: dict | None = None):
        from openai import OpenAI
        self.model, self.max_tokens, self.retries, self.extra = model, max_tokens, retries, extra or {}
        self.client = OpenAI(base_url=base_url or os.environ.get("OPENAI_BASE_URL"), api_key=api_key or os.environ.get("OPENAI_API_KEY"), timeout=timeout)

    def __call__(self, prompt: str, images=()) -> dict:
        content = [{"type": "text", "text": prompt}]
        for p in images:
            b64 = base64.b64encode(Path(p).read_bytes()).decode()
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
        kw = dict(model=self.model, messages=[{"role": "user", "content": content}], **self.extra)
        if self.max_tokens:
            kw["max_tokens"] = self.max_tokens
        last = None
        for a in range(self.retries):
            t0 = time.time()
            try:
                r = self.client.chat.completions.create(**kw)
                u = r.usage
                return dict(text=r.choices[0].message.content or "", secs=round(time.time() - t0, 1),
                            tok_in=getattr(u, "prompt_tokens", None), tok_out=getattr(u, "completion_tokens", None),
                            finish_reason=r.choices[0].finish_reason)
            except Exception as e:  # network / rate limit: back off and retry
                last = e
                time.sleep(10 * (a + 1))
        raise RuntimeError(f"model call failed after {self.retries} tries: {last}")


def extract_html(text: str) -> str | None:
    m = re.findall(r"```(?:html|HTML)?\s*\n(.*?)```", text, re.S)
    if m:
        return max(m, key=len)
    i = text.find("<!DOCTYPE")
    i = text.find("<html") if i < 0 else i
    return text[i:] if i >= 0 else None


def extract_json(text: str):
    m = re.search(r"```(?:json)?\s*\n(.*?)```", text, re.S)
    s = m.group(1) if m else text
    return json.loads(s[s.find("{"): s.rfind("}") + 1])


def ask_json(llm: LLM, prompt: str, images=(), tries: int = 3, check=None):
    """call until the reply parses as JSON (and passes check)"""
    last = None
    for i in range(tries):
        r = llm(prompt + ("" if i == 0 else "\n\nReturn only valid JSON."), images)
        try:
            j = extract_json(r["text"])
            if check is None or check(j):
                return j
            last = "check failed"
        except Exception as e:
            last = e
    raise RuntimeError(f"no valid JSON from judge: {last}")
