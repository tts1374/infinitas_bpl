from abc import ABC, abstractmethod

from models.settings import Settings

class ISettingsFileRepository(ABC):
    @abstractmethod
    def load(self) -> Settings:
        """
        設定ファイルから保存した入力項目を取得する
        """
        pass