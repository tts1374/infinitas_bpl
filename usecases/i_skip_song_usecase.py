from abc import ABC, abstractmethod

from models.settings import Settings

class ISkipSongUsecase(ABC):
    @abstractmethod
    async def execute(self, room_id:int, user_token: str, settings:Settings, song_id: int):
        """
        曲スキップを行う
        """