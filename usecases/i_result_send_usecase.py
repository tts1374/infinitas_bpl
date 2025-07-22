from abc import ABC, abstractmethod

from models.settings import Settings

class IResultSendUsecase(ABC):
    @abstractmethod
    def execute(self, user_token: str, settings: Settings, contents):
        """
        リザルト結果を送信する
        """