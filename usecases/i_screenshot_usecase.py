from abc import ABC, abstractmethod

class IScreenshotUsecase(ABC):
    @abstractmethod
    def execute(self, path: str, window_title: str):
        """
        スクリーンショット撮影を行う
        """