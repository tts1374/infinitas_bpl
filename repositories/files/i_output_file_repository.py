from abc import ABC, abstractmethod

from models.settings import Settings

class IOutputFileRepository(ABC):
    @abstractmethod
    def save(self, output):
        """
        結果出力ファイル加工データを保存する
        """
    @abstractmethod
    def load(self):
        """
        結果出力ファイル加工データを取得する
        """
    @abstractmethod
    def clear(self):
        """
        結果出力ファイル加工データをクリアする
        """
