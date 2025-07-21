from abc import ABC, abstractmethod
from typing import Optional

from models.program_update_result import ProgramUpdateResult
from models.settings import Settings

class IAppController(ABC):
    @abstractmethod
    def load_settings(self) -> Settings:
        """
        設定ファイルから保存した入力項目を取得する
        """
    
    def check_update(self) -> ProgramUpdateResult:
        """
        アップデートがあるか確認する
        """

    def perform_update(self, assets) -> Optional[str]:
        """
        アップデート処理を行う
        """
    
    async def start_battle(self, settings: Settings, on_message_callback):
        """
        試合開始処理
        """