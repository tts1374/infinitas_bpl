
import json
from config.config import OPERATION_DELETE
from models.settings import Settings
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.db.i_room_repository import IRoomRepository
from repositories.db.i_song_result_repository import ISongResultRepository
from repositories.db.i_user_repository import IUserRepository
from usecases.i_delete_song_usecase import IDeleteSongUsecase
from utils.common import safe_print

class DeleteSongUsecase(IDeleteSongUsecase):
    def __init__(
        self, 
        room_repository: IRoomRepository, 
        user_repository: IUserRepository, 
        song_result_repository: ISongResultRepository, 
        websocket_clinet: IWebsocketClient
    ):
        self.room_repository = room_repository
        self.user_repository = user_repository
        self.song_result_repository = song_result_repository
        self.websocket_clinet = websocket_clinet

    async def execute(self, room_id:int, user_token: str, settings:Settings, song_id: int):
        try: 
            
            self.settings = settings
            room = self.room_repository.get_by_id(room_id)
            user = self.user_repository.get_by_room_and_token(room.room_id, user_token)
            song_result = self.song_result_repository.get(room.room_id, song_id, user.user_id)
            
            result_data = {
                "mode": self.settings.mode,
                "roomId": self.settings.room_pass,
                "userId": user_token,
                "name": self.settings.djname,
                "resultToken": song_result.result_token,
                "operation": OPERATION_DELETE,
                "result": {
                    "delete": True
                }
            }
            safe_print("[送信データ]")
            safe_print(json.dumps(result_data, ensure_ascii=False, indent=2))
            await self.websocket_clinet.send(result_data)
        except Exception as e:
            print("[Error] skip:", e)
            raise Exception(str(e))