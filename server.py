"""網頁版：python server.py，然後打開 http://localhost:8000

每個瀏覽器分頁一條 WebSocket、一場獨立的遊戲（各自的記憶體資料庫）。
"""
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from ai import models
from ai.session import Scene

WEB = Path(__file__).with_name("web")
app = FastAPI(title="Study Abroad Galgame")


@app.get("/")
def index():
    return FileResponse(WEB / "index.html")


@app.websocket("/ws")
async def play(ws: WebSocket):
    await ws.accept()
    await ws.send_json(models.info())
    scene: Scene | None = None
    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type")
            try:
                if kind == "start":
                    scene = Scene(msg.get("provider"))
                    await ws.send_json(scene.state())
                    await ws.send_json(scene.greeting())
                elif scene is None:
                    await ws.send_json({"type": "error", "message": "請先按 Start 開始遊戲"})
                elif kind == "say" and (text := str(msg.get("text", "")).strip()[:500]):
                    if scene.ctx.checked_out:
                        await ws.send_json({"type": "scene_over"})
                        continue
                    async for ev in scene.turn(text):
                        await ws.send_json(ev)
                elif kind == "end":
                    await ws.send_json({"type": "evaluating"})
                    await ws.send_json(await scene.finish())
            except WebSocketDisconnect:
                raise
            except Exception as e:  # 網路斷線、額度用完時不讓整場遊戲當掉
                await ws.send_json({"type": "error", "message": f"{type(e).__name__}: {str(e)[:300]}"})
    except WebSocketDisconnect:
        pass


app.mount("/", StaticFiles(directory=WEB), name="web")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
