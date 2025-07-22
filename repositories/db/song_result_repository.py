from models.song_result import SongResult
from repositories.db.i_song_result_repository import ISongResultRepository
from utils.common import now_str, safe_int

class SongResultRepository(ISongResultRepository):
    def __init__(self, session):
        self.session = session

    def insert(self, room_id, song_id, user_id, result_token, result):
        rank_str = f"{result['rank']}({result['rankdiff']})"
        song_result = SongResult(
            room_id=room_id,
            song_id=song_id,
            user_id=user_id,
            result_token=result_token,
            score=safe_int(result["score_cur"]),
            miss_count=safe_int(result["bp"], 9999),
            lamp=result["lamp"],
            rank=rank_str,
            created_at=now_str()
        )
        self.session.add(song_result)
        self.session.flush()
        return song_result

    def list_by_song_id(self, song_id: int) -> list[dict]:
        results = (
            self.session.query(
                SongResult.user_id,
                SongResult.score,
                SongResult.miss_count,
                SongResult.lamp,
                SongResult.rank,
            )
            .filter(SongResult.song_id == song_id)
            .order_by(SongResult.user_id)
            .all()
        )
        return [
            {
                "user_id": r.user_id,
                "score": r.score,
                "miss_count": r.miss_count,
                "lamp": r.lamp,
                "rank": r.rank,
            }
            for r in results
        ]