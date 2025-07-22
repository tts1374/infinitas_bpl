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

    def create(self, room_id, level, song_name, play_style, difficulty, notes):
        stage_no = self._count_by_room(room_id) + 1
        song = Song(
            room_id=room_id,
            stage_no=stage_no,
            level=level,
            song_name=song_name,
            play_style=play_style,
            difficulty=difficulty,
            notes=notes,
            created_at=now_str()
        )
        self.session.add(song)
        self.session.flush()
        return song

    def get_or_create(self, room_id, level, song_name, play_style, difficulty, notes, user_id):
        song = self.session.query(Song).filter_by(
            room_id=room_id,
            level=level,
            song_name=song_name,
            play_style=play_style,
            difficulty=difficulty,
            notes=notes
        ).filter(~exists().where(and_(SongResult.song_id == Song.song_id, SongResult.user_id == user_id))).first()
        if song:
            return song
        return self.create(room_id, level, song_name, play_style, difficulty, notes)

    def get_by_id(self, room_id: int, song_id: int) -> Song:
        return self.session.query(Song).filter(Song.room_id == room_id, Song.song_id == song_id).first()
    
    def list_by_room_id(self, room_id: int) -> list[dict]:
        songs = (
            self.session.query(
                Song.song_id,
                Song.stage_no,
                Song.level,
                Song.song_name,
                Song.play_style,
                Song.difficulty,
                Song.notes,
            )
            .filter(Song.room_id == room_id)
            .order_by(Song.stage_no.desc())
            .all()
        )
        return [
            {
                "song_id": s.song_id,
                "stage_no": s.stage_no,
                "level": s.level,
                "song_name": s.song_name,
                "play_style": s.play_style,
                "difficulty": s.difficulty,
                "notes": s.notes,
            }
            for s in songs
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