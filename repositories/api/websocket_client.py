import websockets
import asyncio
import json

from config.config import WEBSOCKET_URL
from errors.connection_failed_error import ConnectionFailedError
from repositories.api.i_websocket_client import IWebsocketClient
import traceback
from utils.common import safe_print

class WebsocketClient(IWebsocketClient):
    def __init__(self):
        self.on_message_callback = None
        self.websocket = None
        
    async def connect(self, room_pass: str, mode: int, on_message_callback):
        self.on_message_callback = on_message_callback
        uri = f"{WEBSOCKET_URL}?roomId={room_pass}&mode={mode}"
        safe_print(f"[WebSocket 接続先] {uri}")
        try:
            self.websocket = await websockets.connect(uri)
            safe_print("[WebSocket 接続成功]")
            self.task = asyncio.create_task(self.receive_loop())
        except Exception as e:
            safe_print("[WebSocket 接続失敗]")
            # エラーログ出力
            with open("error.log", "w", encoding="utf-8") as f:
                f.write("予期せぬエラーが発生しました:\n")
                traceback.print_exc(file=f)
            raise ConnectionFailedError("サーバーに接続できませんでした。")

    async def disconnect(self):
        safe_print("[WebSocket 切断開始]")
        if self.websocket:
            await self.websocket.close()
            self.websocket = None

        if self.task:
            self.task.cancel()
            self.task = None
        safe_print("[WebSocket 切断完了]")

    async def send(self, data):
        if self.websocket:
            await self.websocket.send(json.dumps(data))
            safe_print(f"[送信] {data}")
        else:
            raise RuntimeError("WebSocketが接続されていません。")

    async def receive_loop(self):
        while True:
            try:
                message = await self.websocket.recv()
                safe_print(f"[受信] {message}")
                data = json.loads(message)
                await self.on_message_callback(data)
            except websockets.ConnectionClosed:
                safe_print("[WebSocket 切断検知]")
                break
            except Exception as e:
                safe_print("[WebSocket 受信エラー]:", e)
                break
        
