from abc import ABC, abstractmethod

from models.song_result import SongResult
from models.user import User

class ISongResultRepository(ABC):
    @abstractmethod
    def insert(self, room_id, song_id, user_id, result_token, result):
        """
        リザルト登録
        """
    @abstractmethod
    def get(self, room_id: int, song_id: int, user_id: int) -> SongResult:
        """
        曲IDよりリスト取得
        """
    @abstractmethod
    def list_by_song_id(self, room_id: int, song_id: int) -> list[dict]:
        """
        部屋ID,曲IDよりリスト取得
        """
    @abstractmethod
    def delete(self, room_id:int, song_id:int):
        """
        song_idより対象の削除
        """ 