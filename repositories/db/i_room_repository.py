from abc import ABC, abstractmethod

class IRoomRepository(ABC):
    @abstractmethod
    def insert(self, room_pass, mode, user_num) -> int:
        """
        部屋登録
        """
    