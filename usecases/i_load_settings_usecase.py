from abc import ABC, abstractmethod

from models.settings import Settings

class ILoadSettingsUsecase(ABC):
    @abstractmethod
    def execute(self) -> Settings:
        """
        設定ファイルから保存した入力項目を取得する
        """