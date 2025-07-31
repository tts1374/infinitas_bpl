
import json
import time
import uuid
from models.settings import Settings
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.db.i_room_repository import IRoomRepository
from repositories.db.i_song_repository import ISongRepository
from usecases.i_skip_song_usecase import ISkipSongUsecase
from utils.common import safe_print

class SkipSongUsecase(ISkipSongUsecase):
    def __init__(self, room_repository: IRoomRepository, song_repository: ISongRepository, websocket_clinet: IWebsocketClient):
        self.room_repository = room_repository
        self.song_repository = song_repository
        self.websocket_clinet = websocket_clinet

    async def execute(self, room_id:int, user_token: str, settings:Settings, song_id: int):
        try: 
            self.settings = settings
            room = self.room_repository.get_by_id(room_id)
            song = self.song_repository.get_by_id(room.room_id, song_id)
            
            result_data = {
                "mode": self.settings.mode,
                "roomId": self.settings.room_pass,
                "userId": user_token,
                "name": self.settings.djname,
                "resultToken": str(uuid.uuid4()).replace("-", "") + str(time.time()),
                "result": {
                    "level": str(song.level),
                    "song_name": song.song_name,
                    "play_style": song.play_style,
                    "difficulty": song.difficulty,
                    "score": "0",
                    "miss_count": "9999",
                }
            }
            safe_print("[送信データ]")
            safe_print(json.dumps(result_data, ensure_ascii=False, indent=2))
            await self.websocket_clinet.send_with_retry(result_data)
        except Exception as e:
            safe_print("[Error] skip:", e)
            raise Exception(str(e))