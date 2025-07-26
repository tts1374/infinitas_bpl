from sqlalchemy import Column, Integer, Text, ForeignKey
from db.database import Base
from utils.common import now_str

class Song(Base):
    __tablename__ = "song"

    song_id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("room.room_id"), nullable=False)
    stage_no = Column(Integer, nullable=False)
    level = Column(Integer, nullable=False)
    song_name = Column(Text, nullable=False)
    play_style = Column(Text, nullable=False)
    difficulty = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, default=now_str)