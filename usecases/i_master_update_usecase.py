from abc import ABC, abstractmethod

from models.settings import Settings


class IMasterUpdateUsecase(ABC):
    @abstractmethod
    def execute(self, settings: Settings) -> str:
        """
        マスタ更新を行う
        """