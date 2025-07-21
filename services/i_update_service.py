from abc import ABC, abstractmethod
from typing import Optional

from models.program_update_result import ProgramUpdateResult

class IUpdateService(ABC):
    @abstractmethod
    def check_update(self) -> ProgramUpdateResult:
        """
        プログラムの更新があるかチェックする
        """
        pass
    
    def perform_update(self, assets) -> Optional[str]:
        """
        プログラムの更新を行う
        """
        pass