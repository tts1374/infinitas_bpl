from sqlalchemy import Column, Integer, Text
from db.database import Base
from utils.common import now_str

class Room(Base):
    __tablename__ = "room"

    room_id = Column(Integer, primary_key=True, autoincrement=True)
    room_pass = Column(Text, nullable=False)
    mode = Column(Integer, nullable=False)
    user_num = Column(Integer, nullable=False)
    created_at = Column(Text, nullable=False, default=now_str)