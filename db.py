"""遊戲資料：商品、玩家、購物車、購物清單。價格和庫存只存在這裡，LLM 改不到。"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).with_name("game.db")

# name, aliases（逗號分隔）, aisle, price, unit, stock
PRODUCTS = [
    ("2% milk", "milk,whole milk,dairy milk", "Aisle 5 (dairy)", 4.29, "1 gallon", 8),
    ("oat milk", "oatmilk,plant milk", "Aisle 5 (dairy)", 5.49, "half gallon", 0),
    ("eggs", "egg,a dozen eggs,dozen eggs", "Aisle 5 (dairy)", 3.99, "a dozen", 6),
    ("whole wheat bread", "bread,toast,loaf", "Aisle 2 (bakery)", 3.49, "1 loaf", 5),
    ("apples", "apple,fuji apple", "Aisle 1 (produce)", 0.89, "each", 40),
    ("bananas", "banana", "Aisle 1 (produce)", 0.29, "each", 30),
    ("green onions", "scallions,spring onions,scallion", "Aisle 1 (produce)", 1.29, "1 bunch", 10),
    ("instant noodles", "ramen,noodles,cup noodles", "Aisle 3 (dry goods)", 4.99, "5-pack", 12),
    ("jasmine rice", "rice", "Aisle 3 (dry goods)", 6.99, "5 lb bag", 7),
    ("chicken breast", "chicken", "Aisle 6 (meat)", 8.49, "1 pack", 4),
    ("dish soap", "dishwashing liquid,washing-up liquid,detergent", "Aisle 7 (household)", 3.29, "1 bottle", 9),
    ("toilet paper", "tissue,toilet roll", "Aisle 7 (household)", 7.99, "6 rolls", 6),
]

# 任務清單：故意寫 scallions，店裡標的是 green onions，練同義詞
SHOPPING_LIST = [("2% milk", 1), ("eggs", 1), ("whole wheat bread", 1),
                 ("apples", 3), ("green onions", 1), ("dish soap", 1)]
LIST_WORDING = {"2% milk": "milk", "eggs": "a dozen eggs", "whole wheat bread": "bread",
                "apples": "3 apples", "green onions": "scallions", "dish soap": "dish soap"}
START_MONEY = 25.00


def connect(reset: bool = False) -> sqlite3.Connection:
    if reset and DB_PATH.exists():
        DB_PATH.unlink()
    # Agents SDK 會在另一個執行緒跑工具，所以要允許跨執行緒使用
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS products(
        id INTEGER PRIMARY KEY, name TEXT UNIQUE, aliases TEXT, aisle TEXT,
        price REAL, unit TEXT, stock INTEGER);
    CREATE TABLE IF NOT EXISTS player(id INTEGER PRIMARY KEY, money REAL);
    CREATE TABLE IF NOT EXISTS cart(product_id INTEGER PRIMARY KEY, qty INTEGER);
    CREATE TABLE IF NOT EXISTS purchases(
        id INTEGER PRIMARY KEY, product_id INTEGER, qty INTEGER, price REAL,
        ts TEXT DEFAULT CURRENT_TIMESTAMP);
    """)
    if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
        conn.executemany(
            "INSERT INTO products(name,aliases,aisle,price,unit,stock) VALUES(?,?,?,?,?,?)", PRODUCTS)
        conn.execute("INSERT INTO player(id,money) VALUES(1,?)", (START_MONEY,))
        conn.commit()
    return conn