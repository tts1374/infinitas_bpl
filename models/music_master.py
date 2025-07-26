from sqlalchemy import Column, Integer, Text, ForeignKey
from db.database import Base
from utils.common import now_str

class MusicMaster(Base):
    __tablename__ = "music_master"

    music_master_id = Column(Integer, primary_key=True, autoincrement=True)
    level = Column(Integer, nullable=False)
    song_name = Column(Text, nullable=False)
    play_style = Column(Text, nullable=False)
    difficulty = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, default=now_str)