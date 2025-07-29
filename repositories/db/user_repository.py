from models.user import User
from repositories.db.i_user_repository import IUserRepository
from utils.common import now_str

class UserRepository(IUserRepository):
    def __init__(self, session):
        self.session = session

    def get_by_room_and_token(self, room_id: int, user_token: str):
        return self.session.query(User).filter_by(room_id=room_id, user_token=user_token).first()

    def create(self, room_id: int, user_token: str, user_name: str) -> str:
        user = User(
            room_id=room_id,
            user_token=user_token,
            user_name=user_name,
            created_at=now_str()
        )
        self.session.add(user)
        self.session.flush()  # user.id取得用
        return user.user_token

    def get_or_create(self, room_id: int, user_token: str, user_name: str) -> User:
        user = self.get_by_room_and_token(room_id, user_token)
        if user:
            return user
        user = User(
            room_id=room_id,
            user_token=user_token,
            user_name=user_name,
            created_at=now_str()
        )
        self.session.add(user)
        self.session.flush()
        return user

    def count_by_room(self, room_id: int) -> int:
        return self.session.query(User).filter_by(room_id=room_id).count()
    
    def list_by_room_id(self, room_id: int) -> list[dict]:
        users = (
            self.session.query(User.user_id, User.user_name)
            .filter(User.room_id == room_id)
            .order_by(User.user_id)
            .all()
        )
        return [{"user_id": u.user_id, "user_name": u.user_name} for u in users]