from abc import ABC, abstractmethod

from models.song import Song
from models.user import User

class ISongRepository(ABC):
    @abstractmethod
    def create(self, room_id, level, song_name, play_style, difficulty, notes) -> Song:
        """
        ユーザ登録
        """
    @abstractmethod
    def get_or_create(self, room_id, level, song_name, play_style, difficulty, notes, user_id) -> Song:
        """
        曲登録(すでに存在する場合は該当ユーザを返却)
        """
    @abstractmethod   
    def get_by_id(self, song_id: int) -> Song:
        """
        曲IDより1件取得
        """ 
    @abstractmethod   
    def list_by_room_id(self, room_id: int) -> list[dict]:
        """
        部屋IDよりリスト取得
        """