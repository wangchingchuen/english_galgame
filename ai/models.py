"""模型供應者：本機 Ollama 和雲端 OpenAI 相容服務（GitHub Models 等）可以同時使用。

店員每句話都要呼叫模型 → 預設用本機 Ollama（免費、沒有速率限制）
評分只在場景結束呼叫一次 → 預設用雲端模型（比較準）
"""
import os
from dataclasses import dataclass

from openai import AsyncOpenAI
from agents import OpenAIChatCompletionsModel, set_tracing_disabled

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

set_tracing_disabled(True)  # trace 預設送到 OpenAI；我們自己在畫面上記 trace


@dataclass
class Provider:
    id: str
    label: str
    base_url: str
    api_key: str
    model: str

    @property
    def available(self) -> bool:
        return bool(self.base_url and self.api_key and self.model)

    def build(self) -> OpenAIChatCompletionsModel:
        client = AsyncOpenAI(base_url=self.base_url, api_key=self.api_key, max_retries=0)
        return OpenAIChatCompletionsModel(model=self.model, openai_client=client)


def providers() -> dict[str, Provider]:
    om = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    cm = os.getenv("MODEL", "openai/gpt-4o-mini")
    return {
        "ollama": Provider("ollama", f"Ollama {om}（本機）",
                           os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"), "ollama", om),
        "cloud": Provider("cloud", f"{cm}（雲端）", os.getenv("LLM_BASE_URL", ""),
                          os.getenv("LLM_API_KEY", ""), cm),
    }


def get(pid: str | None, fallback_env: str = "PROVIDER") -> Provider:
    ps = providers()
    p = ps.get(pid or os.getenv(fallback_env, "ollama"))
    if p and p.available:
        return p
    for p in ps.values():  # 指定的不能用就換一個能用的
        if p.available:
            return p
    raise RuntimeError("沒有可用的模型：請在 .env 設定 Ollama 或 LLM_BASE_URL / LLM_API_KEY")


def info() -> dict:
    ps = providers()
    return {"type": "info", "default": os.getenv("PROVIDER", "ollama"),
            "providers": [{"id": p.id, "label": p.label, "available": p.available} for p in ps.values()]}
