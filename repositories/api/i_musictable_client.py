from abc import ABC, abstractmethod

from models.musictable_load_result import MusictableLoadResult

class IMusictableClient(ABC):
    @abstractmethod
    def check_and_load_pickle(self) -> MusictableLoadResult:
        """
        githubからリソースデータを取得する
        """
        pass