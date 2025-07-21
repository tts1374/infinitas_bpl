from sqlalchemy import Column, Integer, Text, ForeignKey
from db.database import Base
from utils.common import now_str

class User(Base):
    __tablename__ = "user"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("room.room_id"), nullable=False)
    user_token = Column(Text, nullable=False)
    user_name = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, default=now_str)