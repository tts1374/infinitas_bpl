from abc import ABC, abstractmethod

from models.settings import Settings

class ISettingsService(ABC):
    @abstractmethod
    def load_settings(self) -> Settings:
        """
        設定ファイルから保存した入力項目を取得する
        """
        pass