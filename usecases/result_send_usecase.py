
import json
import time
import uuid
from models.settings import Settings
from repositories.api.i_websocket_client import IWebsocketClient
from usecases.i_result_send_usecase import IResultSendUsecase
from utils.common import safe_print
import xml.etree.ElementTree as ET

class ResultSendUsecase(IResultSendUsecase):
    def __init__(self, websocket_client: IWebsocketClient):
        self.websocket_client = websocket_client

    def execute(self, user_token: str, settings: Settings, content):
        root = ET.fromstring(content)
        first_item = root.find('item')
        if first_item is None:
            raise ValueError("XMLに<item>がありません")

        result_data = {
            "mode": settings.mode,
            "roomId": settings.room_pass,
            "userId": user_token,
            "name": settings.djname,
            "resultToken": str(uuid.uuid4()).replace("-", "") + str(time.time()),
            "result": {child.tag: child.text for child in first_item}
        }
        safe_print("[送信データ]")
        safe_print(json.dumps(result_data, ensure_ascii=False, indent=2))
        return self.websocket_client.send(result_data)