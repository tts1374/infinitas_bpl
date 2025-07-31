from abc import ABC, abstractmethod

from models.settings import Settings

class IInfNotebookFileRepository(ABC):
    @abstractmethod
    def load_export(self, settings: Settings):
        """
        設定ファイルに入力値を保存する
        """