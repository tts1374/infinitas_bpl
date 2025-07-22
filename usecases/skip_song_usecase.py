
import json
import time
import uuid
from models.settings import Settings
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.db.i_song_repository import ISongRepository
from usecases.i_skip_song_usecase import ISkipSongUsecase
from utils.common import safe_print

class SkipSongUsecase(ISkipSongUsecase):
    def __init__(self, song_repository: ISongRepository, websocket_clinet: IWebsocketClient):
        self.song_repository = song_repository
        self.websocket_clinet = websocket_clinet

    async def execute(self, user_token: str, settings:Settings, song_id: int):
        try: 
            self.settings = settings
            song = self.song_repository.get_by_id(song_id)
            
            # 難易度変換マップ
            diff_map = {
                "BEGINNER": "B",
                "NORMAL": "N",
                "HYPER": "H",
                "ANOTHER": "A",
                "LEGGENDARIA": "L"
            }

            # play_style変換
            if song.play_style == "DB":
                converted_playstyle = "DP"
            else:
                converted_playstyle = song.play_style

            # difficulty変換
            converted_difficulty = f"{converted_playstyle}{diff_map.get(song.difficulty, '?')}"

            # opt変換
            converted_opt = "BATTLE" if song.play_style == "DB" else ""

            result_data = {
                "mode": self.settings.mode,
                "roomId": self.settings.room_pass,
                "userId": user_token,
                "name": self.settings.djname,
                "resultToken": str(uuid.uuid4()).replace("-", "") + str(time.time()),
                "result": {
                    "lv": str(song.level),
                    "title": song.song_name,
                    "difficulty": converted_difficulty,
                    "dp_unofficial_lv": None,
                    "sp_12hard": None,
                    "sp_12clear": None,
                    "lamp": "FAILED",
                    "score": "0",
                    "opt": converted_opt,
                    "bp": "9999",
                    "bpi": "??",
                    "notes": str(song.notes),
                    "score_cur": "0",
                    "score_pre": "0",
                    "lamp_pre": "FAILED",
                    "bp_pre": "0",
                    "rank_pre": "F",
                    "rank": "F",
                    "rankdiff": "F+0",
                    "rankdiff0": "F",
                    "rankdiff1": "+0",
                    "scorerate": "0"
                }
            }
            safe_print("[送信データ]")
            safe_print(json.dumps(result_data, ensure_ascii=False, indent=2))
            await self.websocket_clinet.send(result_data)
        except Exception as e:
            print("[Error] skip:", e)
            raise Exception(str(e))