from itertools import groupby

from config.config import OPERATION_DELETE, OPERATION_REGISTER
from models.settings import Settings
from repositories.db.i_room_repository import IRoomRepository
from repositories.db.i_song_repository import ISongRepository
from repositories.db.i_song_result_repository import ISongResultRepository
from repositories.db.i_user_repository import IUserRepository
from repositories.files.i_output_file_repository import IOutputFileRepository
from usecases.i_battle_result_handler import IBattleResultHandler


class BattleResultHandler(IBattleResultHandler):
    def __init__(
        self, 
        output_file_repository: IOutputFileRepository,
        session, 
        room_repository: IRoomRepository, 
        user_repository: IUserRepository,
        song_repository: ISongRepository,
        song_result_repository: ISongResultRepository
    ):
        self.output_file_repository = output_file_repository
        self.session = session
        self.room_repository = room_repository
        self.user_repository = user_repository
        self.song_repository = song_repository
        self.song_result_repository = song_result_repository
        self.app_on_message_callback = None
        self.settings = None
        self.room_id = None
    
    def set_param(self, room_id: int, settings: Settings, app_on_message_callback):
        self.room_id = room_id
        self.settings = settings
        self.app_on_message_callback = app_on_message_callback
        
    async def handle(self, data):
        try:
            if data["operation"] == OPERATION_REGISTER:
                # User取得
                user_token = data["userId"]
                user_name = data["name"]
                user = self.user_repository.get_by_room_and_token(self.room_id, user_token)
                if not user:
                    print("[Create User]")
                    # roomの定員をroom_repositoryから取得
                    room = self.room_repository.get_by_id(self.room_id)
                    if room is None:
                        raise Exception("部屋情報が見つかりません")
                    # 定員以上の登録しようとしている場合はエラー
                    current_user_count = self.user_repository.count_by_room(self.room_id)
                    if current_user_count >= room.user_num:
                        raise Exception("定員オーバーです。対戦を行う場合は部屋の再作成を行ってください。")
                    # ユーザ登録
                    user = self.user_repository.get_or_create(self.room_id, user_token, user_name)

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

                # 曲の登録
                song = self.song_repository.get_or_create(self.room_id, level, song_name, play_style, difficulty, notes, user.user_id)

                # 結果登録
                result_token = data["resultToken"]
                self.song_result_repository.insert(self.room_id, song.song_id, user.user_id, result_token, result)

                self.session.commit()
                
                # 結果出力ファイル保存
                output = self._get_output_data()  
                self.output_file_repository.save(output)
                # UI側処理
                self.app_on_message_callback()

                # ログ出力
                print("[Result JSON]", output)
            
            elif data["operation"] == OPERATION_DELETE:
                print("削除処理開始")
                user_token = data["userId"]
                
                # 部屋の存在確認
                room = self.room_repository.get_by_id(self.room_id)
                if room is None:
                    raise Exception("部屋情報が見つかりません")
                # ユーザーの存在確認
                user = self.user_repository.get_by_room_and_token(self.room_id, user_token)
                if not user:
                    raise Exception("ユーザー情報が見つかりません")
                
                # 削除対象の曲データを取得
                song = self.song_repository.get_by_result_token(self.room_id, data["resultToken"])
                if not song:
                    raise Exception("削除対象の曲が見つかりません")

                print(f"削除対象の曲： {song.song_id}")
                # song_idに紐づくSong_resultの削除
                self.song_result_repository.delete(self.room_id, song.song_id)
                # song_idに紐づくSongの削除
                self.song_repository.delete(self.room_id, song.song_id)
                self.session.commit()
                
                # 結果出力ファイル保存
                output = self._get_output_data()  
                self.output_file_repository.save(output)
                # UI側処理
                self.app_on_message_callback()
                
        except Exception as e:
            print("[Error] on_message_callback:", e)
            self.session.rollback()
            raise Exception(str(e))
        finally:
            self.session.close()
    
    def _get_output_data(self):
        output = {
            "mode": self.settings.mode,
            "users": [],
            "songs": []
        }

        users = self.user_repository.list_by_room_id(self.room_id)
        for user in users:
            output["users"].append({
                "user_id": user["user_id"],
                "user_name": user["user_name"]
            })

        songs = self.song_repository.list_by_room_id(self.room_id)
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

            results = self.song_result_repository.list_by_song_id(self.room_id, song["song_id"])

            # 順位ソート用キー
            if self.settings.mode in [1, 2]:
                sort_key = lambda x: x["score"]
            else:
                sort_key = lambda x: -x["miss_count"]

            # スコアで降順ソートget
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
        return output