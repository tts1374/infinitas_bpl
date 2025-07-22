from abc import ABC, abstractmethod

from models.user import User

class ISongResultRepository(ABC):
    @abstractmethod
    def insert(self, room_id, song_id, user_id, result_token, result):
        """
        リザルト登録
        """
    @abstractmethod
    def list_by_song_id(self, song_id: int) -> list[dict]:
        """
        曲IDよりリスト取得
        """