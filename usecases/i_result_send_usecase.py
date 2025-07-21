from abc import ABC, abstractmethod

from models.settings import Settings

class IResultSendUsecase(ABC):
    @abstractmethod
    def execute(self):
        """
        リザルト結果を送信する
        """