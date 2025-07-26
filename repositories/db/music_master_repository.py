from typing import List
from models.music_master import MusicMaster
from repositories.db.i_music_master_repository import IMusicMasterRepository

class MusicMasterRepository(IMusicMasterRepository):
    def __init__(self, session):
        self.session = session

    def insert_many(self, items: List[MusicMaster]) -> None:
        if not items:
            return
        try:
            # ORMのバルクインサート（高速・flushあり）
            self.session.bulk_save_objects(items)
            self.session.commit()
        except Exception as e:
            self.session.rollback()
            raise RuntimeError(f"バルクインサート中にエラーが発生しました: {e}")

    def clear(self) -> None:
        try:
            # 全データ削除
            self.session.query(MusicMaster).delete()
            self.session.commit()
        except Exception as e:
            self.session.rollback()
            raise RuntimeError(f"全削除中にエラーが発生しました: {e}")
        
    def get(self, song_name, play_style, difficulty) -> MusicMaster:
        return self.session.query(MusicMaster).filter(
            MusicMaster.song_name == song_name, 
            MusicMaster.play_style == play_style, 
            MusicMaster.difficulty == difficulty
            ).first()