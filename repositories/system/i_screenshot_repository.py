from abc import ABC, abstractmethod

class IScreenshotRepository(ABC):
    @abstractmethod
    def take_screenshot(self, path: str, region: tuple):
        """
        スクリーンショット撮影する
        """
        pass
    