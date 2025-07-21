from sqlalchemy import Column, Integer, Text, ForeignKey
from db.database import Base
from utils.common import now_str

class SongResult(Base):
    __tablename__ = "song_result"

    song_result_id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("room.room_id"), nullable=False)
    song_id = Column(Integer, ForeignKey("song.song_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.user_id"), nullable=False)
    result_token = Column(Text, nullable=False)
    score = Column(Integer, nullable=False)
    miss_count = Column(Integer, nullable=False)
    lamp = Column(Text, nullable=False)
    rank = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, default=now_str)