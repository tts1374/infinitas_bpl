from abc import ABC, abstractmethod

from models.settings import Settings

class IBattleResultHandler(ABC):
    @abstractmethod
    async def set_param(self, room_id: int, settings: Settings):
        """
        受信時のパラメータをセットする
        """
    @abstractmethod
    async def handle(self, data):
        """
        リザルト受信時の動作設定する
        """