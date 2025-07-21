from abc import ABC, abstractmethod

from models.settings import Settings

class IStopBattleUsecase(ABC):
    @abstractmethod
    async def execute(self):
        """
        対戦終了処理を行う
        """