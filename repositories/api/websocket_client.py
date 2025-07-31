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
        self.room_pass = None
        self.mode = None
        self.websocket = None
        self.ping_task = None
        
    async def connect(self, room_pass: str, mode: int, on_message_callback):
        self.room_pass = room_pass
        self.mode = mode
        self.on_message_callback = on_message_callback
        uri = f"{WEBSOCKET_URL}?roomId={room_pass}&mode={mode}"
        safe_print(f"[WebSocket 接続先] {uri}")
        try:
            self.websocket = await websockets.connect(uri)
            safe_print("[WebSocket 接続成功]")
            self.task = asyncio.create_task(self.receive_loop())
            self.ping_task = asyncio.create_task(self.keep_alive())
        except Exception as e:
            safe_print("[WebSocket 接続失敗]")
            with open("error.log", "w", encoding="utf-8") as f:
                f.write("予期せぬエラーが発生しました:\n")
                traceback.print_exc(file=f)
            raise ConnectionFailedError("サーバーに接続できませんでした。")

    async def reconnect(self):
        safe_print("[WebSocket 再接続開始]")
        try:
            await self.disconnect()
            await asyncio.sleep(1)  # 少し待機（サーバー側処理のため）
            await self.connect(self.room_pass, self.mode, self.on_message_callback)
            safe_print("[WebSocket 再接続成功]")
        except Exception as e:
            safe_print(f"[WebSocket 再接続失敗] {e}")
            raise ConnectionFailedError("WebSocketの再接続に失敗しました。")
        
    async def disconnect(self):
        safe_print("[WebSocket 切断開始]")
        if self.websocket:
            await self.websocket.close()
            self.websocket = None

        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None
        
        if self.ping_task:
            self.ping_task.cancel()
            try:
                await self.ping_task
            except asyncio.CancelledError:
                pass
            self.ping_task = None
        safe_print("[WebSocket 切断完了]")

    async def _send(self, data):
        if not self.websocket:
            raise RuntimeError("WebSocketが接続されていません。")
        try:
            await asyncio.wait_for(self.websocket.send(json.dumps(data)), timeout=5)  # 任意でタイムアウトを設定
            safe_print(f"[送信] {data}")
        except asyncio.TimeoutError:
            safe_print("[送信エラー] タイムアウトしました")
            raise
        except websockets.ConnectionClosed as e:
            safe_print(f"[送信エラー] 接続が切断されました: {e}")
            raise
        except Exception as e:
            safe_print(f"[送信エラー] 予期せぬエラー: {e}")
            raise

    async def send_with_retry(self, data, retries=3):
        for attempt in range(1, retries + 1):
            try:
                await self._send(data)
                return
            except (websockets.ConnectionClosed, asyncio.TimeoutError, OSError) as e:
                safe_print(f"[送信失敗 {attempt}/{retries}] {e} → 再接続します")
                try:
                    await self.reconnect()
                except ConnectionFailedError:
                    safe_print("[再接続失敗] 中断します")
                    break
                await asyncio.sleep(1)
            except Exception as e:
                safe_print(f"[致命的な送信エラー] {e}")
                break
        raise RuntimeError("WebSocket送信リトライ上限に達しました")
    
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
            
    async def keep_alive(self, interval=300): 
        while True:
            try:
                await asyncio.sleep(interval)
                if self.websocket:
                    await self.websocket.ping()
                    safe_print("[Ping送信]")
            except Exception as e:
                safe_print(f"[Ping送信エラー] {e}")
                break
