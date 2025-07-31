from abc import ABC, abstractmethod

class IWindowRepository(ABC):
    @abstractmethod
    def find_window_by_title(self, title: str):
        """
        タイトルからウィンドウを取得する
        """
        pass
    
    def calculate_capture_region(self, win):
        """
        ウィンドウ調整する
        """
        pass