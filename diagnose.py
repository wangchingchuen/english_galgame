"""直接打 API，比較「走系統代理」和「不走代理」兩種情況，找出是誰回了奇怪的內容。"""
import os, json, urllib.request
import httpx
from dotenv import load_dotenv

load_dotenv(override=True)
base = os.getenv("LLM_BASE_URL").rstrip("/")
key = os.getenv("LLM_API_KEY") or ""
model = os.getenv("MODEL")
print("系統代理設定 =", urllib.request.getproxies() or "無")

url = base + "/chat/completions"
body = {"model": model, "messages": [{"role": "user", "content": "Say hi"}]}
headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

for label, trust in [("走系統代理", True), ("不走代理", False)]:
    print(f"\n===== {label} =====")
    try:
        with httpx.Client(trust_env=trust, timeout=30) as c:
            r = c.post(url, headers=headers, json=body)
        print("HTTP 狀態    =", r.status_code)
        print("Content-Type =", r.headers.get("content-type"))
        print("Server       =", r.headers.get("server"))
        print("回傳前 300 字 =", r.text[:300])
    except Exception as e:
        print("失敗：", type(e).__name__, e)