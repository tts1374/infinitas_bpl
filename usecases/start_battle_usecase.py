

from itertools import groupby
import os
import uuid
from db.database import SessionLocal
from models.settings import Settings
from models.user import User
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.db.i_room_repository import IRoomRepository
from repositories.db.i_song_repository import ISongRepository
from repositories.db.i_song_result_repository import ISongResultRepository
from repositories.db.i_user_repository import IUserRepository
from repositories.db.room_repository import RoomRepository
from repositories.db.song_repository import SongRepository
from repositories.db.song_result_repository import SongResultRepository
from repositories.db.user_repository import UserRepository
from repositories.files.file_watcher import FileWatcher
from repositories.files.i_output_file_repository import IOutputFileRepository
from repositories.files.i_settings_file_repository import ISettingsFileRepository
from usecases.i_start_battle_usecase import IStartBattleUsecase

from utils.common import safe_print

class StartBattleUsecase(IStartBattleUsecase):
    def __init__(
        self, 
        settings_file_repository: ISettingsFileRepository, 
        output_file_repository: IOutputFileRepository,
        session, 
        room_repository: IRoomRepository, 
        user_repository: IUserRepository,
        websocket_clinet: IWebsocketClient
    ):
        self.settings_file_repository = settings_file_repository
        self.output_file_repository = output_file_repository
        self.session = session
        self.room_repository = room_repository
        self.user_repository = user_repository
        self.websocket_clinet = websocket_clinet
        self.app_on_message_callback = None
        self.settings = None
        self.room_id = None

    async def execute(self, settings: Settings, app_on_message_callback) -> str:
        self.settings = settings
        self.app_on_message_callback = app_on_message_callback
        # 設定ファイルの保存
        self.settings_file_repository.save(settings)
        
        try:
            # DBに部屋とユーザを作成
            self.room_id = self.room_repository.insert(
                room_pass= settings.room_pass,
                mode= settings.mode,
                user_num= settings.user_num
            )

            user_token = self.user_repository.create(
                room_id=self.room_id,
                user_token=str(uuid.uuid4()),
                user_name=settings.djname
            )
            
            # Websocketに接続
            await self.websocket_clinet.connect(settings.room_pass, settings.mode, self._on_message_callback)

            self.session.commit()
            
            return user_token

        except Exception as e:
            self.session.rollback()
            raise e

        finally:
            self.session.close()
        
    async def _on_message_callback(self, data):
        try:
            with SessionLocal() as session:
                print("[Create User]")
                # Repositoryインスタンス生成
                room_repo = RoomRepository(session)
                user_repo = UserRepository(session)
                song_repo = SongRepository(session)
                song_result_repo = SongResultRepository(session)
                
                # roomの定員をroom_repositoryから取得
                room = room_repo.get_by_id(self.room_id)
                if room is None:
                    raise Exception("部屋情報が見つかりません")

                current_user_count = user_repo.count_by_room(self.room_id)

                user_token = data["userId"]
                user_name = data["name"]
                user = user_repo.get_by_room_and_token(self.room_id, user_token)

                if not user:
                    if current_user_count >= room.user_num:
                        raise Exception("定員オーバーです。対戦を行う場合は部屋の再作成を行ってください。")
                    user = user_repo.create(self.room_id, user_token, user_name)

                # 曲情報パース
                result = data["result"]
                level = int(result["lv"])
                song_name = result["title"]
                difficulty_raw = result["difficulty"]
                opt = result["opt"]
                notes = int(result["notes"])

                if difficulty_raw.startswith("SP"):
                    play_style = "SP"
                elif difficulty_raw.startswith("DP"):
                    play_style = "DB" if opt.startswith("BATTLE") else "DP"
                else:
                    play_style = "UNKNOWN"

                diff_map = {"B": "BEGINNER", "N": "NORMAL", "H": "HYPER", "A": "ANOTHER", "L": "LEGGENDARIA"}
                difficulty = diff_map.get(difficulty_raw[-1], "UNKNOWN")

                song = song_repo.get_or_create(self.room_id, level, song_name, play_style, difficulty, notes)

                # 結果登録
                result_token = data["resultToken"]
                song_result_repo.insert(self.room_id, song.song_id, user.user_id, result_token, result)

                session.commit()
                
                output = {
                    "mode": self.settings.mode,
                    "users": [],
                    "songs": []
                }

                users = user_repo.list_by_room_id(self.room_id)
                for user in users:
                    output["users"].append({
                        "user_id": user["user_id"],
                        "user_name": user["user_name"]
                    })

                songs = song_repo.list_by_room_id(self.room_id)
                for song in songs:
                    song_dict = {
                        "song_id": song["song_id"],
                        "stage_no": song["stage_no"],
                        "level": song["level"],
                        "song_name": song["song_name"],
                        "play_style": song["play_style"],
                        "difficulty": song["difficulty"],
                        "notes": song["notes"],
                        "results": []
                    }

                    results = song_result_repo.list_by_song_id(song["song_id"])

                    # 順位ソート用キー
                    if self.settings.mode in [1, 2]:
                        sort_key = lambda x: x["score"]
                    else:
                        sort_key = lambda x: -x["miss_count"]

                    # スコアで降順ソート
                    sorted_results = sorted(results, key=sort_key, reverse=True)

                    # pt計算
                    pt_dict = {}  # user_id -> pt

                    if len(results) >= self.settings.user_num:
                        rank = 0
                        pt_value = 2 if self.settings.mode in [1, 3] else 1

                        # groupbyで同点グループにまとめる
                        for score_value, group in groupby(sorted_results, key=sort_key):
                            same_rank_users = list(group)

                            for user in same_rank_users:
                                pt_dict[user["user_id"]] = pt_value

                            # ptは順位で減らす（同点は同じpt）
                            if self.settings.mode in [1, 3]:
                                pt_value = max(pt_value - 1, 0)  # 最小0
                            elif self.settings.mode in [2, 4]:
                                pt_value = 0  # 1位だけ1pt
                            # 次の順位へ（rankを使う場合は += len(same_rank_users))

                    else:
                        # 人数が足りないときは全員0pt
                        for res in results:
                            pt_dict[res["user_id"]] = 0

                    # 結果に反映
                    for res in results:
                        song_dict["results"].append({
                            "user_id": res["user_id"],
                            "score": res["score"],
                            "miss_count": res["miss_count"],
                            "lamp": res["lamp"],
                            "rank": res["rank"],
                            "pt": pt_dict[res["user_id"]]
                        })

                    output["songs"].append(song_dict)
            # 結果出力ファイル保存
            self.output_file_repository.save(output)
            # UI側処理
            self.app_on_message_callback()

            # ログ出力
            print("[Result JSON]", output)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)

            logger.error("", stack_info=True)
            print("[Error] on_message_callback:", e)
            raise Exception(str(e))
