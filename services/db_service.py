import sqlite3
from utils.common import now_str

class DBService:
    def __init__(self, db_file):
        self.db_file = db_file

    def register_room_and_user(self, settings):
        conn = sqlite3.connect(self.db_file)
        c = conn.cursor()

        c.execute("INSERT INTO room (room_pass, mode, user_num, created_at) VALUES (?, ?, ?, ?)", (
            settings['room_pass'], settings['mode'], settings['user_num'], now_str()
        ))
        room_id = c.lastrowid

        import uuid
        user_token = str(uuid.uuid4())
        c.execute("INSERT INTO user (room_id, user_token, user_name, created_at) VALUES (?, ?, ?, ?)", (
            room_id, user_token, settings['djname'], now_str()
        ))

        conn.commit()
        conn.close()

        return room_id, user_token

    def insert_song_and_result(self, room_id, data):
        conn = sqlite3.connect(self.db_file)
        c = conn.cursor()

        # 定員チェック
        c.execute("SELECT user_num FROM room WHERE room_id=?", (room_id,))
        room_row = c.fetchone()
        if not room_row:
            conn.close()
            raise Exception("部屋情報が見つかりません")

        user_num = room_row[0]

        c.execute("SELECT COUNT(*) FROM user WHERE room_id=?", (room_id,))
        current_user_count = c.fetchone()[0]

        # 既存ユーザーかどうか判定
        c.execute("SELECT user_id FROM user WHERE room_id=? AND user_token=?", (room_id, data["userId"]))
        user_row = c.fetchone()

        if not user_row:
            # 新規登録なので、定員チェック
            if current_user_count >= user_num:
                conn.close()
                raise Exception("定員オーバーです。対戦を行う場合は部屋の再作成を行ってください。")

            # 新規ユーザー登録
            user_id = self._get_or_create_user(c, room_id, data["userId"], data["name"])
        else:
            user_id = user_row[0]

        song_id = self._get_or_create_song(c, room_id, data["result"])

        result = data["result"]
        rank_str = f"{result['rank']}({result['rankdiff']})"

        c.execute("""INSERT INTO song_result 
            (room_id, song_id, user_id, score, miss_count, lamp, rank, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (room_id, song_id, user_id, int(result["score_cur"]), int(result["bp"]),
            result["lamp"], rank_str, now_str()))

        conn.commit()

    def _get_or_create_user(self, c, room_id, user_token, user_name):
        c.execute("SELECT user_id FROM user WHERE room_id=? AND user_token=?", (room_id, user_token))
        row = c.fetchone()
        if row:
            return row[0]

        c.execute("INSERT INTO user (room_id, user_token, user_name, created_at) VALUES (?, ?, ?, ?)",
                  (room_id, user_token, user_name, now_str()))
        return c.lastrowid

    def _get_or_create_song(self, c, room_id, result):
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

        c.execute("""SELECT song_id FROM song WHERE level=? AND song_name=? 
                     AND play_style=? AND difficulty=? AND notes=? AND room_id=?""",
                  (level, song_name, play_style, difficulty, notes, room_id))
        row = c.fetchone()

        if row:
            return row[0]

        # 曲数+1でstage_noを決定
        c.execute("SELECT COUNT(*) FROM song WHERE room_id=?", (room_id,))
        current_count = c.fetchone()[0]
        stage_no = current_count + 1

        c.execute("""INSERT INTO song (room_id, stage_no, level, song_name, play_style, difficulty, notes, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (room_id, stage_no, level, song_name, play_style, difficulty, notes, now_str()))
        return c.lastrowid

    def get_users(self, room_id):
        conn = sqlite3.connect(self.db_file)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT user_id, user_name FROM user WHERE room_id=? ORDER BY user_id", (room_id,))
        users = [dict(row) for row in c.fetchall()]
        conn.close()
        return users

    def get_songs(self, room_id):
        conn = sqlite3.connect(self.db_file)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("""SELECT song_id, stage_no, level, song_name, play_style, difficulty, notes 
                     FROM song WHERE room_id=? ORDER BY stage_no DESC""", (room_id,))
        songs = [dict(row) for row in c.fetchall()]
        conn.close()
        return songs

    def get_song_results(self, song_id):
        conn = sqlite3.connect(self.db_file)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("""SELECT user_id, score, miss_count, lamp, rank FROM song_result 
                     WHERE song_id=? ORDER BY user_id""", (song_id,))
        results = [dict(row) for row in c.fetchall()]
        conn.close()
        return results
    
    def get_song_by_id(self, song_id):
        conn = sqlite3.connect(self.db_file)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("""SELECT song_id, stage_no, level, song_name, play_style, difficulty, notes, room_id 
                    FROM song WHERE song_id=?""", (song_id,))
        row = c.fetchone()
        conn.close()

        if row:
            return dict(row)
        else:
            return None