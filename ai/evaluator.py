"""評分 Agent（LLM-as-judge）：場景結束時讀整段對話，輸出英文能力的變化。

只負責「判斷」，不能改遊戲狀態；輸出由程式檢查範圍後才寫進玩家檔案。
"""
from pydantic import BaseModel, Field
from agents import Agent, Runner


class Score(BaseModel):
    fluency: int = Field(description="-2 to 2. How smoothly and naturally the player spoke.")
    politeness: int = Field(description="-2 to 2. Polite phrases like please, thank you, excuse me, could I.")
    accuracy: int = Field(description="-2 to 2. Grammar and word choice.")
    vocab: list[str] = Field(description="Up to 5 useful English words or phrases from this scene the player used or should learn.")
    tips: list[str] = Field(description="2 or 3 short tips in Traditional Chinese (繁體中文), each quoting a better English sentence.")
    summary: str = Field(description="One encouraging sentence in Traditional Chinese.")


EVAL_PROMPT = """
You are a strict but kind English speaking coach for a Taiwanese exchange student.
You read the transcript of a role-play at a supermarket and grade ONLY the player's English
(lines marked PLAYER). The clerk's lines are context. Lines the player wrote in Chinese count as
not speaking English. Use the full -2..2 range: 0 means average for an intermediate learner.
Write `tips` and `summary` in Traditional Chinese (繁體中文), not English. In each tip, quote the
player's sentence and a more natural English version using 「」 brackets, never double quotes,
e.g. 把「I want milk」改成「Could I get some milk?」比較禮貌。
`vocab` must not be empty: pick useful shopping words from the scene (e.g. aisle, receipt, out of stock).
"""


def clamp(score: Score) -> dict:
    """引擎端驗證：分數限制在 -2..2，字彙和建議限制數量。"""
    c = lambda v: max(-2, min(2, int(v)))
    return {"fluency": c(score.fluency), "politeness": c(score.politeness), "accuracy": c(score.accuracy),
            "vocab": [v for v in score.vocab if v][:5], "tips": score.tips[:3], "summary": score.summary}


async def evaluate(model, transcript: list[tuple[str, str]], outcome: dict) -> dict | None:
    if not any(who == "PLAYER" for who, _ in transcript):
        return None
    lines = "\n".join(f"{who}: {text}" for who, text in transcript)
    task = (f"<transcript>\n{lines}\n</transcript>\n"
            f"<outcome>Bought {outcome['completed']}/{outcome['total_items']} list items, "
            f"${outcome['money_left']:.2f} left.</outcome>")
    agent = Agent(name="Coach", instructions=EVAL_PROMPT, model=model, output_type=Score)
    result = await Runner.run(agent, task, max_turns=1)
    return clamp(result.final_output)
