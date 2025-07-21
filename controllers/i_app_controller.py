from abc import ABC, abstractmethod

class IAppController(ABC):
    @abstractmethod
    def load_settings(self):
        """
        設定ファイルから保存した入力項目を取得する
        """
        pass