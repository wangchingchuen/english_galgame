"""場景規則手冊（Scene Skill）：每個場景一個資料夾，裡面一份 SKILL.md。

前面的 frontmatter 給程式看（NPC 名字、開場白、固定台詞），後面的內容在場景開始時才放進 Prompt。
之後加新場景（上課、派對……）只要新增一個資料夾，不用改程式。
"""
from dataclasses import dataclass
from pathlib import Path

SCENES = Path(__file__).resolve().parent.parent / "scenes"


@dataclass
class SceneSkill:
    name: str
    meta: dict
    body: str


def load(name: str) -> SceneSkill:
    text = (SCENES / name / "SKILL.md").read_text(encoding="utf-8")
    meta, body = {}, text
    if text.startswith("---"):
        _, head, body = text.split("---", 2)
        for line in head.strip().splitlines():
            k, _, v = line.partition(":")
            meta[k.strip()] = v.strip()
    return SceneSkill(name, meta, body.strip())


def available() -> list[str]:
    return sorted(p.parent.name for p in SCENES.glob("*/SKILL.md"))
