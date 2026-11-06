"""終端機版（除錯用）：python main.py [ollama|cloud]。網頁版請執行 python server.py。"""
import asyncio
import sys

from ai.session import Scene
from engine.tools import view_cart_logic

DIM, RED, RESET = "\033[2m", "\033[31m", "\033[0m"


def show_list(scene: Scene):
    s = scene.state()
    print("\n📝 " + ", ".join(("✅" if i["done"] else "🛒" if i["in_cart"] >= i["need"] else "⬜") + i["label"]
                            for i in s["list"]))
    print(f"💵 ${s['money']:.2f}\n")


async def main():
    scene = Scene(sys.argv[1] if len(sys.argv) > 1 else None)
    print(f"=== Maple Corner Market ===（模型：{scene.provider.label}）")
    print("指令：/list 看清單  /cart 看購物籃  /quit 離開")
    show_list(scene)
    print(f"Maya: {scene.greeting()['line']}")

    while not scene.ctx.checked_out:
        text = input("\nYou: ").strip()
        if not text:
            continue
        if text == "/quit":
            break
        if text == "/list":
            show_list(scene); continue
        if text == "/cart":
            print(view_cart_logic(scene.ctx.conn)); continue
        try:
            async for ev in scene.turn(text):
                t = ev["type"]
                if t == "tool":
                    print(f"{DIM}  [tool] {ev['name']}({ev['args']}) -> {ev['result']}{RESET}")
                elif t == "guardrail":
                    print(f"{DIM}  [guardrail:{ev['name']}] {ev['detail']}{RESET}")
                elif t == "clerk":
                    print(f"Maya ({ev['emotion']}): {ev['line']}")
                elif t == "usage":
                    print(f"{DIM}  ({ev['tokens']} tokens, 累計 {ev['total']}){RESET}")
        except Exception as e:
            print(f"{RED}  [錯誤] {type(e).__name__}: {str(e)[:300]}{RESET}")

    print("\n評分中…")
    r = await scene.finish()
    print("\n========== 場景結果 ==========")
    for i in r["items"]:
        print(f"{'✅' if i['ok'] else '❌'} {i['label']}（買了 {i['bought']}）")
    if r["extra"]:
        print("🛒 清單外：" + ", ".join(r["extra"]))
    print(f"完成 {r['completed']}/{r['total_items']}，剩下 ${r['money_left']:.2f}")
    if r["score"]:
        s = r["score"]
        print(f"流暢 {s['fluency']:+d}  禮貌 {s['politeness']:+d}  正確 {s['accuracy']:+d}")
        print("新單字：" + ", ".join(s["vocab"]))
        for tip in s["tips"]:
            print(" ・" + tip)
        print(s["summary"])


if __name__ == "__main__":
    asyncio.run(main())
