from abc import ABC, abstractmethod

from models.musictable_load_result import MusictableLoadResult
from models.settings import Settings

class IMusictableFileRepository(ABC):
    @abstractmethod
    def load(self, settings: Settings) -> MusictableLoadResult:
        """
        リソースデータを取得する
        """
        pass