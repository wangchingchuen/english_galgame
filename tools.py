"""店員可以呼叫的工具。規則都在這裡檢查：LLM 只能提出要求，不能直接改錢或價格。"""
from dataclasses import dataclass, field
import sqlite3
from agents import RunContextWrapper, function_tool

DIM, RESET = "\033[2m", "\033[0m"


@dataclass
class GameContext:
    conn: sqlite3.Connection
    checked_out: bool = False
    tool_log: list = field(default_factory=list)


def _log(ctx: GameContext, name: str, args: dict, result: str):
    ctx.tool_log.append((name, args, result))
    print(f"{DIM}  [tool] {name}({args}) -> {result}{RESET}")


def _match(conn, query: str):
    """依名稱或別名找商品，不分大小寫。"""
    q = query.strip().lower()
    rows = conn.execute("SELECT * FROM products").fetchall()
    exact = [r for r in rows if q == r["name"] or q in r["aliases"].split(",")]
    if exact:
        return exact
    return [r for r in rows if q in r["name"] or any(q in a for a in r["aliases"].split(","))]


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
        return "Rejected: quantity must be between 1 and 20."
    rows = _match(conn, product_name)
    if len(rows) != 1:
        return f"Rejected: '{product_name}' matched {len(rows)} products. Ask the customer which one."
    p = rows[0]
    in_cart = conn.execute("SELECT qty FROM cart WHERE product_id=?", (p["id"],)).fetchone()
    new_qty = (in_cart["qty"] if in_cart else 0) + quantity
    if new_qty > p["stock"]:
        return f"Rejected: only {p['stock']} {p['name']} in stock."
    conn.execute("INSERT OR REPLACE INTO cart(product_id,qty) VALUES(?,?)", (p["id"], new_qty))
    conn.commit()
    return f"Added {quantity} x {p['name']}. Now {new_qty} in cart."


def remove_from_cart_logic(conn, product_name: str, quantity: int) -> str:
    rows = _match(conn, product_name)
    if len(rows) != 1:
        return f"Rejected: '{product_name}' matched {len(rows)} products."
    p = rows[0]
    in_cart = conn.execute("SELECT qty FROM cart WHERE product_id=?", (p["id"],)).fetchone()
    if not in_cart:
        return f"{p['name']} is not in the cart."
    left = in_cart["qty"] - quantity
    if left > 0:
        conn.execute("UPDATE cart SET qty=? WHERE product_id=?", (left, p["id"]))
    else:
        conn.execute("DELETE FROM cart WHERE product_id=?", (p["id"],))
    conn.commit()
    return f"Removed. {max(left, 0)} x {p['name']} left in cart."


def cart_summary(conn):
    rows = conn.execute("""SELECT p.name, p.price, c.qty FROM cart c
                           JOIN products p ON p.id=c.product_id""").fetchall()
    total = round(sum(r["price"] * r["qty"] for r in rows), 2)
    return rows, total


def view_cart_logic(conn) -> str:
    rows, total = cart_summary(conn)
    if not rows:
        return "Cart is empty."
    lines = [f"{r['qty']} x {r['name']} = ${r['price'] * r['qty']:.2f}" for r in rows]
    return "\n".join(lines) + f"\nTotal: ${total:.2f}"


def checkout_logic(ctx: GameContext) -> str:
    conn = ctx.conn
    rows, total = cart_summary(conn)
    if not rows:
        return "Rejected: cart is empty."
    money = conn.execute("SELECT money FROM player WHERE id=1").fetchone()["money"]
    if total > money:
        return f"Payment declined: total ${total:.2f}, customer only has ${money:.2f}. Customer must remove something."
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


# ---------- 包成工具給 Agent 用 ----------
def _tool_error(ctx, error: Exception) -> str:
    """工具出錯時印在終端機，不要默默吞掉（不然只會看到店員說查不到）。"""
    print(f"\033[31m  [tool error] {type(error).__name__}: {error}\033[0m")
    return f"Tool error: {error}. Tell the customer the system has a problem."


tool = lambda f: function_tool(f, failure_error_function=_tool_error)

@tool
def find_product(ctx: RunContextWrapper[GameContext], query: str) -> str:
    """Look up a product by English name. Returns aisle, price, unit and stock.

    Args:
        query: Product name in English, e.g. "milk" or "scallions".
    """
    r = find_product_logic(ctx.context.conn, query)
    _log(ctx.context, "find_product", {"query": query}, r.replace("\n", " / "))
    return r


@tool
def add_to_cart(ctx: RunContextWrapper[GameContext], product_name: str, quantity: int) -> str:
    """Put an item into the customer's basket. Only call when the customer clearly says they want it.

    Args:
        product_name: Exact product name from find_product.
        quantity: How many units, 1 to 20.
    """
    r = add_to_cart_logic(ctx.context.conn, product_name, quantity)
    _log(ctx.context, "add_to_cart", {"product_name": product_name, "quantity": quantity}, r)
    return r


@tool
def remove_from_cart(ctx: RunContextWrapper[GameContext], product_name: str, quantity: int) -> str:
    """Take an item out of the customer's basket.

    Args:
        product_name: Exact product name.
        quantity: How many units to remove.
    """
    r = remove_from_cart_logic(ctx.context.conn, product_name, quantity)
    _log(ctx.context, "remove_from_cart", {"product_name": product_name, "quantity": quantity}, r)
    return r


@tool
def view_cart(ctx: RunContextWrapper[GameContext]) -> str:
    """Show what is in the basket and the current total."""
    r = view_cart_logic(ctx.context.conn)
    _log(ctx.context, "view_cart", {}, r.replace("\n", " / "))
    return r


@tool
def checkout(ctx: RunContextWrapper[GameContext]) -> str:
    """Charge the customer for everything in the basket. Only call when the customer asks to pay."""
    r = checkout_logic(ctx.context)
    _log(ctx.context, "checkout", {}, r)
    return r


ALL_TOOLS = [find_product, add_to_cart, remove_from_cart, view_cart, checkout]