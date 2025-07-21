from abc import ABC, abstractmethod

from models.user import User

class IUserRepository(ABC):
    @abstractmethod
    def create(self, room_id: int, user_token: str, user_name: str) -> str:
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
    def list_by_room_id(self, room_id: int) -> list[dict]:
        """
        部屋IDよりリスト取得
        """
    @abstractmethod
    def get_by_room_and_token(self, room_id: int, user_token: str):
        """
        部屋ID, ユーザトークンより1件取得
        """