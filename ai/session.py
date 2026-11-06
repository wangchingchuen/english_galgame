"""一場超市場景：把玩家的一句話變成一串事件（工具呼叫、guardrail、店員台詞、狀態）。

終端機版（main.py）和網頁版（server.py）共用這裡，只是顯示方式不同。
"""
import asyncio
import os
import json
from typing import AsyncIterator

from openai import RateLimitError
from agents import Runner
from agents.exceptions import (InputGuardrailTripwireTriggered, MaxTurnsExceeded, ModelBehaviorError,
                               OutputGuardrailTripwireTriggered)

from engine import db, state
from engine.tools import LOGIC, GameContext
from . import models
from .clerk import ClerkReply, build_clerk, find_tool_text, parse_reply, to_history
from .evaluator import evaluate
from .skills import load

NUDGE_TOOL = ("SYSTEM NOTE: Your last reply wrote a tool call as plain text, so it did NOT run. "
              "Use the real tool-calling interface, then answer the customer.")
NUDGE_CLAIM = ("SYSTEM NOTE: You told the customer you did something, but you did NOT call {0}. "
               "Nothing changed in the basket. Call {0} now with the right product and quantity, "
               "then tell the customer what really happened.")
NUDGE_JSON = "SYSTEM NOTE: Your last reply was not valid. Reply again: [emotion] then what you say."


class Scene:
    def __init__(self, provider: str | None = None, scene: str = "supermarket"):
        self.provider = models.get(provider)
        self.skill = load(scene)
        self.ctx = GameContext(conn=db.connect())
        self.clerk = build_clerk(self.skill, self.provider.build())
        g = self.skill.meta["greeting"]
        self.history: list = [{"role": "assistant", "content": to_history(ClerkReply(line=g, emotion="happy"))}]
        self.transcript: list[tuple[str, str]] = [("CLERK", g)]
        self.total_tokens = 0

    def greeting(self) -> dict:
        return {"type": "clerk", "line": self.skill.meta["greeting"],
                "emotion": self.skill.meta.get("greeting_emotion", "happy")}

    def state(self) -> dict:
        return state.snapshot(self.ctx.conn, self.ctx.checked_out)

    def _say(self, reply: ClerkReply) -> dict:
        self.transcript.append(("CLERK", reply.line))
        return {"type": "clerk", "line": reply.line, "emotion": reply.emotion}

    async def turn(self, text: str) -> AsyncIterator[dict]:
        self.transcript.append(("PLAYER", text))
        base = self.history + [{"role": "user", "content": text}]
        extra: list = []  # 重試時補給模型的系統提示 / 程式代為執行的工具結果
        self.ctx.turn_start = len(self.ctx.tool_log)
        yield {"type": "thinking"}

        for attempt in range(4):
            pending: dict[str, dict] = {}  # call_id → 工具呼叫（平行呼叫時用 id 配對結果）
            try:
                result = Runner.run_streamed(self.clerk, base + extra, context=self.ctx, max_turns=8)
                async for ev in result.stream_events():
                    if ev.type != "run_item_stream_event":
                        continue
                    if ev.name == "tool_called":
                        raw = ev.item.raw_item
                        try:
                            args = json.loads(getattr(raw, "arguments", "") or "{}")
                        except json.JSONDecodeError:
                            args = {"raw": getattr(raw, "arguments", "")}
                        pending[getattr(raw, "call_id", "")] = {"type": "tool", "name": getattr(raw, "name", "?"), "args": args}
                    elif ev.name == "tool_output":
                        raw = ev.item.raw_item
                        cid = raw.get("call_id", "") if isinstance(raw, dict) else getattr(raw, "call_id", "")
                        call = pending.pop(cid, {"type": "tool", "name": "?", "args": {}})
                        yield {**call, "result": str(ev.item.output)}
                        yield self.state()
                reply = parse_reply(str(result.final_output))
            except InputGuardrailTripwireTriggered:
                line = self.skill.meta["language_refusal"]
                yield {"type": "guardrail", "name": "language", "detail": "非英文輸入，程式直接回覆，沒有呼叫模型"}
                self.history = base + [{"role": "assistant", "content": to_history(ClerkReply(line=line, emotion="confused"))}]
                yield self._say(ClerkReply(line=line, emotion="confused"))
                return
            except OutputGuardrailTripwireTriggered as e:
                info = e.guardrail_result.output.output_info
                if "missing" in info:  # 說了「幫你加進購物籃」卻沒呼叫工具
                    said = _final_text(e)
                    yield {"type": "guardrail", "name": "claim_without_tool",
                           "detail": f"店員說要做 {', '.join(info['missing'])} 但沒呼叫工具，退回重做"}
                    extra.append({"role": "assistant", "content": said})
                    extra.append({"role": "system", "content": NUDGE_CLAIM.format(", ".join(info["missing"]))})
                    if attempt >= 2:  # 重做兩次還是不行：讓店員不要宣稱做了
                        extra.append({"role": "system", "content": "If you are not sure, ask the customer to confirm instead."})
                    continue
                async for ev in self._recover(info["calls"], attempt, extra):
                    yield ev
                continue
            except ModelBehaviorError as e:  # 小模型常把工具 JSON 直接當回答，結構化輸出解析失敗
                calls = find_tool_text(_raw_text(e))
                if calls:
                    async for ev in self._recover(calls, attempt, extra):
                        yield ev
                else:
                    yield {"type": "guardrail", "name": "bad_json", "detail": str(e)[:200]}
                    extra.append({"role": "system", "content": NUDGE_JSON})
                continue
            except MaxTurnsExceeded:  # 模型一直呼叫工具停不下來
                yield {"type": "guardrail", "name": "max_turns", "detail": "工具呼叫超過 8 次，程式接手"}
                if self.ctx.checked_out:  # 錢已經付了：用固定台詞收尾
                    reply = ClerkReply(line="Here's your receipt. Thanks for shopping at Maple Corner Market. Have a great day!",
                                       emotion="happy")
                    self.history = base + [{"role": "assistant", "content": to_history(reply)}]
                    yield self._say(reply)
                    yield self.state()
                    yield {"type": "scene_over"}
                    return
                extra.append({"role": "system", "content": "SYSTEM NOTE: Stop calling tools. Answer the customer now."})
                continue
            except RateLimitError:
                yield {"type": "guardrail", "name": "rate_limit", "detail": "超過每分鐘請求上限，20 秒後重試"}
                await asyncio.sleep(20)
                continue

            self.history = result.to_input_list()
            used = result.context_wrapper.usage.total_tokens
            self.total_tokens += used
            yield self._say(reply)
            yield {"type": "usage", "tokens": used, "total": self.total_tokens}
            yield self.state()
            if self.ctx.checked_out:
                yield {"type": "scene_over"}
            return

        self.transcript.pop()
        raise RuntimeError("店員連續幾次都沒有正確回覆，這句沒有送出，請換個說法再試一次。")

    async def _recover(self, calls, attempt: int, extra: list) -> AsyncIterator[dict]:
        """前兩次要求模型重送；之後由程式代為執行它想呼叫的工具，再請它根據結果回答。"""
        names = ", ".join(n for n, _ in calls)
        if attempt < 1:
            yield {"type": "guardrail", "name": "tool_text_retry", "detail": f"回答裡出現工具文字（{names}），要求重送"}
            extra.append({"role": "system", "content": NUDGE_TOOL})
            return
        yield {"type": "guardrail", "name": "tool_text_fallback", "detail": f"程式代為執行：{names}"}
        results = []
        for name, args in calls:
            r = LOGIC[name](self.ctx, args)
            self.ctx.tool_log.append((name, args, r))
            results.append(f"{name}({args}) -> {r}")
            yield {"type": "tool", "name": name, "args": args, "result": r}
        yield self.state()
        extra.append({"role": "system", "content": "SYSTEM NOTE: The store system already ran these tools for you:\n"
                      + "\n".join(results) + "\nDo not call them again. Now answer the customer."})

    async def finish(self) -> dict:
        outcome = state.judge(self.ctx.conn)
        try:
            evaluator = models.get(os.getenv("EVAL_PROVIDER", "cloud"))
            score = await evaluate(evaluator.build(), self.transcript, outcome)
        except Exception as e:  # 評分失敗不影響結果畫面
            print(f"[evaluator] {type(e).__name__}: {e}")
            score = None
        return {"type": "result", **outcome, "score": score}


def _final_text(e: OutputGuardrailTripwireTriggered) -> str:
    return str(e.guardrail_result.agent_output or "")


def _raw_text(e: Exception) -> str:
    """從 ModelBehaviorError 盡量撈出模型原始回答。"""
    parts = [str(e)]
    data = getattr(e, "run_data", None)
    for resp in getattr(data, "raw_responses", []) or []:
        for item in getattr(resp, "output", []) or []:
            for c in getattr(item, "content", []) or []:
                parts.append(getattr(c, "text", "") or "")
    return "\n".join(parts)
