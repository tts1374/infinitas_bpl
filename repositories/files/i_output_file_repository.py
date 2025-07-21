from abc import ABC, abstractmethod

from models.settings import Settings

class IOutputFileRepository(ABC):
    @abstractmethod
    def save(self, output):
        """
        結果出力ファイル加工データを保存する
        """
    
