"""店員可以呼叫的工具。規則都在這裡檢查：LLM 只能提出要求，不能直接改錢或價格。"""
from dataclasses import dataclass, field
import sqlite3
import threading
from typing import Annotated

from pydantic import Field
from agents import RunContextWrapper, function_tool


@dataclass
class GameContext:
    conn: sqlite3.Connection
    checked_out: bool = False
    tool_log: list = field(default_factory=list)
    turn_start: int = 0
    # 模型一次呼叫多個工具時，SDK 會平行執行；同一個 SQLite 連線一次只讓一個工具用
    lock: threading.Lock = field(default_factory=threading.Lock)  # 這一輪開始時 tool_log 的長度，用來判斷「這輪真的呼叫了哪些工具」


def _match(conn, query: str):
    """依名稱或別名找商品，不分大小寫。"""
    q = query.strip().lower()
    rows = conn.execute("SELECT * FROM products").fetchall()
    exact = [r for r in rows if q == r["name"] or q in r["aliases"].split(",")]
    if exact:
        return exact
    return [r for r in rows if q in r["name"] or any(q in a for a in r["aliases"].split(","))]


def _unit_note(p) -> str:
    return f"sold per {p['unit']}"


# ---------- 純邏輯（不經過 LLM，可以直接測試） ----------
def find_product_logic(conn, query: str) -> str:
    rows = _match(conn, query)
    if not rows:
        return f"No product matches '{query}'. This store has no such item."
    out = []
    for r in rows:
        stock = "OUT OF STOCK" if r["stock"] == 0 else f"{r['stock']} in stock"
        out.append(f"{r['name']} | {r['aisle']} | ${r['price']:.2f} per {r['unit']} | {stock}")
    return "\n".join(out)


def add_to_cart_logic(conn, product_name: str, quantity: int) -> str:
    if quantity < 1 or quantity > 20:
        return "Rejected: quantity must be between 1 and 20 packages."
    rows = _match(conn, product_name)
    if len(rows) != 1:
        return f"Rejected: '{product_name}' matched {len(rows)} products. Ask the customer which one."
    p = rows[0]
    if p["stock"] == 0:
        return f"Rejected: {p['name']} is OUT OF STOCK."
    in_cart = conn.execute("SELECT qty FROM cart WHERE product_id=?", (p["id"],)).fetchone()
    new_qty = (in_cart["qty"] if in_cart else 0) + quantity
    if new_qty > p["stock"]:
        return (f"Rejected: only {p['stock']} x {p['name']} ({_unit_note(p)}) in stock. "
                f"Check the quantity: it counts packages, not pieces.")
    conn.execute("INSERT OR REPLACE INTO cart(product_id,qty) VALUES(?,?)", (p["id"], new_qty))
    conn.commit()
    return f"Added {quantity} x {p['name']} ({_unit_note(p)}). Now {new_qty} in cart."


def remove_from_cart_logic(conn, product_name: str, quantity: int) -> str:
    rows = _match(conn, product_name)
    if len(rows) != 1:
        return f"Rejected: '{product_name}' matched {len(rows)} products."
    p = rows[0]
    in_cart = conn.execute("SELECT qty FROM cart WHERE product_id=?", (p["id"],)).fetchone()
    if not in_cart:
        return f"{p['name']} is not in the cart."
    left = in_cart["qty"] - max(quantity, 1)
    if left > 0:
        conn.execute("UPDATE cart SET qty=? WHERE product_id=?", (left, p["id"]))
    else:
        conn.execute("DELETE FROM cart WHERE product_id=?", (p["id"],))
    conn.commit()
    return f"Removed. {max(left, 0)} x {p['name']} left in cart."


def cart_summary(conn):
    rows = conn.execute("""SELECT p.name, p.price, p.unit, c.qty FROM cart c
                           JOIN products p ON p.id=c.product_id""").fetchall()
    total = round(sum(r["price"] * r["qty"] for r in rows), 2)
    return rows, total


def view_cart_logic(conn) -> str:
    rows, total = cart_summary(conn)
    if not rows:
        return "Cart is empty."
    lines = [f"{r['qty']} x {r['name']} ({r['unit']}) = ${r['price'] * r['qty']:.2f}" for r in rows]
    return "\n".join(lines) + f"\nTotal: ${total:.2f}"


def checkout_logic(ctx: GameContext) -> str:
    conn = ctx.conn
    rows, total = cart_summary(conn)
    if not rows:
        return "Rejected: cart is empty."
    money = conn.execute("SELECT money FROM player WHERE id=1").fetchone()["money"]
    if total > money:
        return (f"Payment declined: total ${total:.2f}, customer only has ${money:.2f} "
                f"(short ${total - money:.2f}). Customer must remove something.")
    conn.execute("UPDATE player SET money=? WHERE id=1", (round(money - total, 2),))
    for r in conn.execute("SELECT * FROM cart").fetchall():
        price = conn.execute("SELECT price FROM products WHERE id=?", (r["product_id"],)).fetchone()["price"]
        conn.execute("UPDATE products SET stock=stock-? WHERE id=?", (r["qty"], r["product_id"]))
        conn.execute("INSERT INTO purchases(product_id,qty,price) VALUES(?,?,?)",
                     (r["product_id"], r["qty"], price))
    conn.execute("DELETE FROM cart")
    conn.commit()
    ctx.checked_out = True
    return f"Paid ${total:.2f}. Customer has ${money - total:.2f} left. Hand over the receipt and say goodbye."


LOGIC = {  # 工具名稱 → 純邏輯。Agent 工具和「工具呼叫被寫成文字」的備援都走這裡
    "find_product": lambda ctx, a: find_product_logic(ctx.conn, a.get("query") or a.get("product_name", "")),
    "add_to_cart": lambda ctx, a: add_to_cart_logic(ctx.conn, a.get("product_name", ""), int(a.get("quantity", 1))),
    "remove_from_cart": lambda ctx, a: remove_from_cart_logic(ctx.conn, a.get("product_name", ""), int(a.get("quantity", 1))),
    "view_cart": lambda ctx, a: view_cart_logic(ctx.conn),
    "checkout": lambda ctx, a: checkout_logic(ctx),
}


# ---------- 包成工具給 Agent 用 ----------
def _tool_error(ctx, error: Exception) -> str:
    print(f"\033[31m  [tool error] {type(error).__name__}: {error}\033[0m")
    return f"Tool error: {error}. Tell the customer the system has a problem."


tool = lambda f: function_tool(f, failure_error_function=_tool_error)
Qty = Annotated[int, Field(ge=1, le=20, description=(
    "Number of PACKAGES as the store sells them (see the product's unit). "
    "Eggs are sold 'a dozen' per package, so 'a dozen eggs' = 1. "
    "Apples are sold 'each', so 'three apples' = 3."))]


def _run(ctx: RunContextWrapper[GameContext], name: str, args: dict) -> str:
    g = ctx.context
    with g.lock:
        if g.checked_out and name not in ("find_product", "view_cart"):
            r = ("Already paid, nothing to do. Do NOT call any more tools. "
                 "Just thank the customer and say goodbye.")
        else:
            r = LOGIC[name](g, args)
        g.tool_log.append((name, args, r))
    return r


@tool
def find_product(ctx: RunContextWrapper[GameContext], query: str) -> str:
    """Look up a product by English name or synonym. Returns aisle, price, unit (package size) and stock.

    Args:
        query: Product name in English, e.g. "milk" or "scallions".
    """
    return _run(ctx, "find_product", {"query": query})


@tool
def add_to_cart(ctx: RunContextWrapper[GameContext], product_name: str, quantity: Qty) -> str:
    """Put an item into the customer's basket. Call it as soon as the customer clearly says they want it.

    Args:
        product_name: Product name, ideally the exact name from find_product.
        quantity: Number of packages (see unit), 1 to 20.
    """
    return _run(ctx, "add_to_cart", {"product_name": product_name, "quantity": quantity})


@tool
def remove_from_cart(ctx: RunContextWrapper[GameContext], product_name: str, quantity: Qty) -> str:
    """Take an item out of the customer's basket.

    Args:
        product_name: Product name.
        quantity: Number of packages to remove.
    """
    return _run(ctx, "remove_from_cart", {"product_name": product_name, "quantity": quantity})


@tool
def view_cart(ctx: RunContextWrapper[GameContext]) -> str:
    """Show what is in the basket and the current total."""
    return _run(ctx, "view_cart", {})


@tool
def checkout(ctx: RunContextWrapper[GameContext]) -> str:
    """Charge the customer for everything in the basket. Only call when the customer asks to pay."""
    return _run(ctx, "checkout", {})


ALL_TOOLS = [find_product, add_to_cart, remove_from_cart, view_cart, checkout]
