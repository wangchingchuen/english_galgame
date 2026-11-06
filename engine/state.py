"""從資料庫算出畫面要的狀態、給模型看的狀態摘要，以及場景結果。全部由程式決定，不問 LLM。"""
from . import db
from .tools import cart_summary


def snapshot(conn, checked_out: bool = False) -> dict:
    rows, total = cart_summary(conn)
    in_cart, got = db.cart_qty(conn), db.bought(conn)
    items = [{"label": db.LIST_WORDING[n], "need": need, "in_cart": in_cart.get(n, 0),
              "bought": got.get(n, 0), "done": got.get(n, 0) >= need}
             for n, need in db.SHOPPING_LIST]
    cart = [{"name": r["name"], "qty": r["qty"], "price": r["price"], "unit": r["unit"],
             "line_total": round(r["price"] * r["qty"], 2)} for r in rows]
    return {"type": "state", "money": db.money(conn), "list": items, "cart": cart,
            "total": total, "checked_out": checked_out}


def brief(conn) -> str:
    """每一輪注入到店員的 instructions，讓模型以資料庫為準，不靠自己記（修正狀態漂移）。"""
    rows, total = cart_summary(conn)
    in_cart = db.cart_qty(conn)
    cart = ", ".join(f"{r['qty']} x {r['name']} ({r['unit']})" for r in rows) or "empty"
    need = dict(db.SHOPPING_LIST)
    on_list = ", ".join(f"{db.LIST_WORDING[n]} [{'in basket' if in_cart.get(n, 0) >= q else 'not yet'}]"
                        for n, q in need.items())
    extras = [n for n in in_cart if n not in need]
    money = db.money(conn)
    lines = [f"Basket: {cart}. Total ${total:.2f}.",
             f"Customer's wallet: ${money:.2f}." + (" Basket costs MORE than the wallet." if total > money else ""),
             f"Customer's shopping list (HIDDEN from you in the story: never mention it unless payment "
             f"was declined): {on_list}."]
    if extras:
        lines.append(f"Items in basket that are NOT on the list: {', '.join(extras)}. "
                     "If the customer cannot afford the basket, suggest removing these first.")
    return "\n".join(lines)


def judge(conn) -> dict:
    got = db.bought(conn)
    items = [{"label": db.LIST_WORDING[n], "need": need, "bought": got.get(n, 0), "ok": got.get(n, 0) >= need}
             for n, need in db.SHOPPING_LIST]
    extra = [n for n in got if n not in dict(db.SHOPPING_LIST)]
    return {"items": items, "extra": extra, "money_left": db.money(conn),
            "completed": sum(i["ok"] for i in items), "total_items": len(items)}
