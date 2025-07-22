from abc import ABC, abstractmethod
from typing import Optional

from models.program_update_result import ProgramUpdateResult

class IUpdateService(ABC):
    @abstractmethod
    def check_update(self) -> ProgramUpdateResult:
        """
        プログラムの更新があるかチェックする
        """
    @abstractmethod
    def perform_update(self, assets, callback) -> Optional[str]:
        """
        プログラムの更新を行う
        """