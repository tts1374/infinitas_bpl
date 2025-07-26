from sqlalchemy import and_, exists
from models.song import Song
from models.song_result import SongResult
from repositories.db.i_song_repository import ISongRepository
from utils.common import now_str

class SongRepository(ISongRepository):
    def __init__(self, session):
        self.session = session

    def _count_by_room(self, room_id):
        return self.session.query(Song).filter_by(room_id=room_id).count()

    def create(self, room_id, level, song_name, play_style, difficulty):
        stage_no = self._count_by_room(room_id) + 1
        song = Song(
            room_id=room_id,
            stage_no=stage_no,
            level=level,
            song_name=song_name,
            play_style=play_style,
            difficulty=difficulty,
            created_at=now_str()
        )
        self.session.add(song)
        self.session.flush()
        return song

    def get_or_create(self, room_id, level, song_name, play_style, difficulty, user_id):
        song = self.session.query(Song).filter_by(
            room_id=room_id,
            level=level,
            song_name=song_name,
            play_style=play_style,
            difficulty=difficulty
        ).filter(~exists().where(and_(SongResult.song_id == Song.song_id, SongResult.user_id == user_id))).first()
        if song:
            return song
        return self.create(room_id, level, song_name, play_style, difficulty)

    def get_by_id(self, room_id: int, song_id: int) -> Song:
        return self.session.query(Song).filter(Song.room_id == room_id, Song.song_id == song_id).first()
    
    def list_by_room_id(self, room_id: int) -> list[dict]:
        songs = (
            self.session.query(
                Song.song_id,
                Song.level,
                Song.song_name,
                Song.play_style,
                Song.difficulty,
            )
            .filter(Song.room_id == room_id)
            .order_by(Song.song_id.desc())  # 最新順（降順）で取得
            .all()
        )

        total = len(songs)
        return [
            {
                "song_id": s.song_id,
                "stage_no": total - idx,
                "level": s.level,
                "song_name": s.song_name,
                "play_style": s.play_style,
                "difficulty": s.difficulty,
            }
            for idx, s in enumerate(songs)
        ]
        
    def get_by_result_token(self, room_id: int, result_token:str) -> Song:
        song = self.session.query(Song).filter_by(
            room_id=room_id,
        ).filter(exists().where(and_(SongResult.song_id == Song.song_id, SongResult.result_token == result_token))).first()
        return song

    def delete(self, room_id: int, song_id: int):
        self.session.query(Song).filter_by(
            room_id=room_id,
            song_id=song_id
        ).delete()