from abc import ABC, abstractmethod

from models.settings import Settings

class IStartBattleUseCase(ABC):
    @abstractmethod
    async def execute(self, settings: Settings, on_message_callback):
        """
        対戦開始処理を行う
        """