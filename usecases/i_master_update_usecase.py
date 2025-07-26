from abc import ABC, abstractmethod

from models.settings import Settings

class IMasterUpdateUsecase(ABC):
    @abstractmethod
    async def execute(self):
        """
        マスタ更新を行う
        """