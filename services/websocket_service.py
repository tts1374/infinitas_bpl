import websockets
import asyncio
import json

from config.config import WEBSOCKET_URL
from errors.connection_failed_error import ConnectionFailedError
from services.db_service import DBService
from services.json_service import JSONService
import flet as ft
import traceback
from utils.common import safe_print

class WebSocketService:
    def __init__(self, app, db_service: DBService):
        self.app = app
        self.db_service = db_service
        self.websocket = None
        self.task = None

    def get_ws_uri(self):
        return f"{WEBSOCKET_URL}?roomId={self.app.settings['room_pass']}&mode={self.app.settings['mode']}"

    async def connect(self):
        uri = self.get_ws_uri()
        safe_print(f"[WebSocket 接続先] {uri}")
        try:
            self.websocket = await websockets.connect(uri)
            safe_print("websocket get success")
            self.task = asyncio.create_task(self.receive_loop())
            
            # エラーログ出力
            with open("error.log", "w", encoding="utf-8") as f:
                f.write("予期せぬエラーが発生しました:\n")
                traceback.print_exc(file=f)
        except Exception as e:
            raise ConnectionFailedError("サーバーに接続できませんでした。")

    async def disconnect(self):
        if self.websocket:
            await self.websocket.close()
        if self.task:
            self.task.cancel()

    async def send(self, data):
        if self.websocket:
            await self.websocket.send(json.dumps(data))

    async def receive_loop(self):
        while True:
            try:
                message = await self.websocket.recv()
                data = json.loads(message)
                await self.handle_message(data)
            except websockets.ConnectionClosed:
                safe_print("WebSocket closed")
                break

    async def handle_message(self, data):
        try:
            safe_print("[INSERT USER]")
            self.db_service.insert_song_and_result(self.app.room_id, data)
            # JSON出力
            safe_print("[JSON COVERT]")
            json_service = JSONService(self.db_service, self.app.room_id, self.app.settings)
            output = json_service.build_result_json()
            json_service.save_result(output)
            self.app.load_result_table()

            safe_print("[Result JSON]")
            safe_print(json.dumps(output, ensure_ascii=False, indent=4))
        except Exception as e:
            safe_print("[エラー] handle_message:", e)
            await self.app.show_error_dialog(str(e))
        
        
