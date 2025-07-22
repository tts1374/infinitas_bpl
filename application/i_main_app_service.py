from abc import ABC, abstractmethod
from typing import Optional

from models.program_update_result import ProgramUpdateResult
from models.settings import Settings
from models.user import User

class IMainAppSerivce(ABC):
    @abstractmethod
    def load_settings(self) -> Settings:
        """
        設定ファイルから保存した入力項目を取得する
        """
    @abstractmethod
    def check_update(self) -> ProgramUpdateResult:
        """
        アップデートがあるか確認する
        """
    @abstractmethod
    def perform_update(self, assets, callback) -> Optional[str]:
        """
        アップデート処理を行う
        """
    @abstractmethod
    async def start_battle(self, settings: Settings, on_message_callback) -> str:
        """
        試合開始処理
        """
    @abstractmethod
    async def stop_battle(self):
        """
        試合終了処理
        """
    @abstractmethod
    async def result_send(self, user_token:str, settings: Settings, content):
        """
        リザルト送信
        """
    @abstractmethod
    async def skip_song(self, user_token: str, settings:Settings, song_id: int):
        """
        スキップ処理
        """
        
    @abstractmethod
    def initialize_output_file(self):
        """
        出力ファイルの初期化処理
        """