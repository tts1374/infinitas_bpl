from abc import ABC, abstractmethod

class IInfNotebookFileRepository(ABC):
    @abstractmethod
    def load_export(self, record_filepath: str):
        """
        設定ファイルに入力値を保存する
        """