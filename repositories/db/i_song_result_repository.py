from abc import ABC, abstractmethod

from models.user import User

class ISongResultRepository(ABC):
    @abstractmethod
    def create(self, room_id: int, user_token: str, user_name: str) -> User:
        """
        ユーザ登録
        """
    @abstractmethod
    def get_or_create(self, room_id: int, user_token: str, user_name: str) -> User:
        """
        ユーザ登録(すでに存在する場合は該当ユーザを返却)
        """
    @abstractmethod
    def count_by_room(self, room_id: int) -> int:
        """
        部屋内のユーザー数取得
        """
    @abstractmethod
    def list_by_song_id(self, song_id: int) -> list[dict]:
        """
        曲IDよりリスト取得
        """