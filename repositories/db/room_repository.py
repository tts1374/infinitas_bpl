from models.room import Room
from repositories.db.i_room_repository import IRoomRepository

class RoomRepository(IRoomRepository):
    def __init__(self, session):
        self.session = session

    def insert(self, room_pass, mode, user_num):
        room = Room(room_pass=room_pass, mode=mode, user_num=user_num)
        self.session.add(room)
        self.session.flush()  # id取得のため
        return room.room_id

        return self.session.query(Room).filter(Room.room_pass == room_pass).first()
    def get_by_id(self, room_id) -> Room:
        return self.session.query(Room).filter(Room.room_id == room_id).first()