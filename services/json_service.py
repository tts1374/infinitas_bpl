import json
from itertools import groupby

class JSONService:
    def __init__(self, db_service, room_id, settings):
        self.db_service = db_service
        self.room_id = room_id
        self.settings = settings

    def build_result_json(self):
        output = {
            "mode": self.settings["mode"],
            "users": [],
            "songs": []
        }

        users = self.db_service.get_users(self.room_id)
        for user in users:
            output["users"].append({
                "user_id": user["user_id"],
                "user_name": user["user_name"]
            })

        songs = self.db_service.get_songs(self.room_id)
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

            results = self.db_service.get_song_results(song["song_id"])

            # 順位ソート用キー
            if self.settings["mode"] in [1, 2]:
                sort_key = lambda x: x["score"]
            else:
                sort_key = lambda x: -x["miss_count"]

            # スコアで降順ソート
            sorted_results = sorted(results, key=sort_key, reverse=True)

            # pt計算
            pt_dict = {}  # user_id -> pt

            if len(results) >= self.settings["user_num"]:
                rank = 0
                pt_value = 2 if self.settings["mode"] in [1, 3] else 1

                # groupbyで同点グループにまとめる
                for score_value, group in groupby(sorted_results, key=sort_key):
                    same_rank_users = list(group)

                    for user in same_rank_users:
                        pt_dict[user["user_id"]] = pt_value

                    # ptは順位で減らす（同点は同じpt）
                    if self.settings["mode"] in [1, 3]:
                        pt_value = max(pt_value - 1, 0)  # 最小0
                    elif self.settings["mode"] in [2, 4]:
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
        

    def save_result(self, output, filename="result_output.json"):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=4)