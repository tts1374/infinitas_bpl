from abc import ABC, abstractmethod

class IWebsocketClient(ABC):
    @abstractmethod
    async def connect(self, room_pass: str, mode: int, on_message_callback):
        """
        Websocketに接続する
        """
    
    async def disconnect(self):
        """
        Websocketから切断する
        """
    
    async def send_with_retry(self, data, retries=3):
        """
        Websocketにメッセージを送信する
        """