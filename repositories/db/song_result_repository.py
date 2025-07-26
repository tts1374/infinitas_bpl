from models.song_result import SongResult
from repositories.db.i_song_result_repository import ISongResultRepository
from utils.common import now_str, safe_int

class SongResultRepository(ISongResultRepository):
    def __init__(self, session):
        self.session = session

    def insert(self, room_id, song_id, user_id, result_token, score, miss_count):
        song_result = SongResult(
            room_id=room_id,
            song_id=song_id,
            user_id=user_id,
            result_token=result_token,
            score=safe_int(score),
            miss_count=safe_int(miss_count, 9999),
            created_at=now_str()
        )
        self.session.add(song_result)
        self.session.flush()
        return song_result

    def get(self, room_id: int, song_id: int, user_id: int) -> SongResult:
        song_result = self.session.query(SongResult).filter(
            SongResult.room_id == room_id, 
            SongResult.song_id == song_id,
            SongResult.user_id == user_id,
            ).first()
        return song_result
            
    def list_by_song_id(self, room_id: int, song_id: int) -> list[dict]:
        results = (
            self.session.query(
                SongResult.user_id,
                SongResult.score,
                SongResult.miss_count,
            )
            .filter(SongResult.room_id == room_id, SongResult.song_id == song_id)
            .order_by(SongResult.user_id)
            .all()
        )
        return [
            {
                "user_id": r.user_id,
                "score": r.score,
                "miss_count": r.miss_count,
            }
            for r in results
        ]

    def delete(self, room_id: int, song_id: int):
        self.session.query(SongResult).filter_by(
            room_id=room_id,
            song_id=song_id
        ).delete()