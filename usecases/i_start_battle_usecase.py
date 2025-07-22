from abc import ABC, abstractmethod
from typing import Tuple

from models.settings import Settings
from models.user import User

class IStartBattleUsecase(ABC):
    @abstractmethod
    async def execute(self, settings: Settings, on_message_callback) -> Tuple[int, str]:
        """
        対戦開始処理を行う
        """