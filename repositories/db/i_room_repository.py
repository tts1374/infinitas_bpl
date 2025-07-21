from abc import ABC, abstractmethod

from models.room import Room

class IRoomRepository(ABC):
    @abstractmethod
    def insert(self, room_pass, mode, user_num) -> int:
        """
        部屋登録
        """
    @abstractmethod
    def get_by_id(self, room_id) -> Room:
        """
        IDより1件取得
        """
    