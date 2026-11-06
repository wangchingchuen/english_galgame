"""引擎規則測試：不呼叫模型，錢和庫存的規則要永遠正確。"""
from ai.clerk import find_tool_text, is_not_english
from ai.evaluator import Score, clamp
from ai.skills import load
from engine import db, state
from engine.tools import (GameContext, add_to_cart_logic, checkout_logic,
                          find_product_logic, remove_from_cart_logic)


def new():
    return GameContext(conn=db.connect())


def test_synonym_and_out_of_stock():
    c = new().conn
    assert "green onions" in find_product_logic(c, "scallions")
    assert "OUT OF STOCK" in find_product_logic(c, "oat milk")
    assert add_to_cart_logic(c, "oat milk", 1).startswith("Rejected")


def test_quantity_is_packages():
    c = new().conn
    r = add_to_cart_logic(c, "eggs", 12)
    assert r.startswith("Rejected") and "packages" in r
    assert "a dozen" in add_to_cart_logic(c, "eggs", 1)


def test_full_list_costs_19_02_and_checkout():
    ctx = new()
    for name, q in db.SHOPPING_LIST:
        assert add_to_cart_logic(ctx.conn, name, q).startswith("Added")
    assert state.snapshot(ctx.conn)["total"] == 19.02
    assert checkout_logic(ctx).startswith("Paid")
    r = state.judge(ctx.conn)
    assert r["completed"] == 6 and r["money_left"] == 5.98


def test_declined_when_over_budget_and_extras_reported():
    ctx = new()
    for name, q in db.SHOPPING_LIST:
        add_to_cart_logic(ctx.conn, name, q)
    add_to_cart_logic(ctx.conn, "toilet paper", 3)
    assert checkout_logic(ctx).startswith("Payment declined")
    assert db.money(ctx.conn) == 25.0 and not ctx.checked_out
    assert "toilet paper" in state.brief(ctx.conn)
    remove_from_cart_logic(ctx.conn, "toilet paper", 3)
    assert checkout_logic(ctx).startswith("Paid")


def test_language_guardrail():
    assert is_not_english("這個衛生紙可以退掉嗎？")
    assert is_not_english("Can I 退貨 這個嗎")
    assert not is_not_english("Can I return the toilet paper?")
    assert not is_not_english("$4.29?")


def test_tool_text_detector():
    t = 'Ronaldo, "{"name": "remove_from_cart", "arguments": {"product_name": "toilet paper", "quantity": 3}}"'
    assert find_tool_text(t) == [("remove_from_cart", {"product_name": "toilet paper", "quantity": 3})]
    assert find_tool_text("Sure, I'll add that for you!") == []


def test_score_clamped():
    s = clamp(Score(fluency=5, politeness=-9, accuracy=1, vocab=list("abcdefg"), tips=["x"] * 5, summary="ok"))
    assert (s["fluency"], s["politeness"], len(s["vocab"]), len(s["tips"])) == (2, -2, 5, 3)


def test_skill_loads():
    sk = load("supermarket")
    assert sk.meta["npc"] == "Maya" and "<store_rules>" in sk.body


def test_parse_emotion_tag():
    from ai.clerk import parse_reply
    r = parse_reply("[Sorry] Oat milk is out of stock.")
    assert (r.emotion, r.line) == ("sorry", "Oat milk is out of stock.")
    assert parse_reply("Maya: Hello!").emotion == "neutral"
    assert parse_reply("(happy): Hi!").line == "Hi!"


def test_claim_without_tool():
    from ai.clerk import unbacked_claims
    ctx = new()
    assert unbacked_claims(ctx, "Adding three apples to your cart now.") == ["add_to_cart"]
    ctx.tool_log.append(("add_to_cart", {}, "Added"))
    assert unbacked_claims(ctx, "Adding three apples to your cart now.") == []
    assert unbacked_claims(ctx, "Apples are in aisle 1.") == []
    assert unbacked_claims(ctx, "And one bottle of dish soap, right? Let's add that too.") == []  # add 已呼叫
    assert unbacked_claims(new(), "Let me check out your payment.") == ["checkout"]


def test_tool_func_text_and_paid_lock():
    assert find_tool_text('find_product({"query": "oat milk"})') == [("find_product", {"query": "oat milk"})]
    assert find_tool_text("view_cart()") == [("view_cart", {})]


def test_after_checkout_tools_say_stop():
    from agents import RunContextWrapper
    from engine.tools import _run
    ctx = new()
    w = RunContextWrapper(context=ctx)
    _run(w, "add_to_cart", {"product_name": "eggs", "quantity": 1})
    assert _run(w, "checkout", {}).startswith("Paid")
    assert "Do NOT call" in _run(w, "checkout", {})          # 不能再結帳一次
    assert "Do NOT call" in _run(w, "add_to_cart", {"product_name": "milk", "quantity": 1})
    assert _run(w, "view_cart", {}) == "Cart is empty."        # 唯讀工具還能用，避免模型卡迴圈
    assert db.money(ctx.conn) == 21.01
