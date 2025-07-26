from abc import ABC, abstractmethod
from typing import List

from models.music_master import MusicMaster

class IMusicMasterRepository(ABC):
    @abstractmethod
    def insert_many(self, items: List[MusicMaster]) -> None:
        """
        マスタデータ登録(bulk insert)
        """
    @abstractmethod
    def clear(self) -> None:
        """
        データのクリア
        """
    
    @abstractmethod
    def get(song_name, play_style, difficulty) -> MusicMaster:
        """
        曲情報からデータの１件取得
        """