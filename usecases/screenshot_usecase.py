
from repositories.system.screenshot_repository import ScreenshotRepository
from repositories.system.window_repository import WindowRepository
from usecases.i_screenshot_usecase import IScreenshotUsecase

class ScreenshotUsecase(IScreenshotUsecase):
    def __init__(self, window_repository: WindowRepository, screenshot_repository: ScreenshotRepository):
        self.window_repository = window_repository
        self.screenshot_repository = screenshot_repository

    def execute(self, path: str, window_title: str):
        win = self.window_repository.find_window_by_title(window_title)
        if not win:
            raise RuntimeError("ウィンドウが見つかりません")

        region = self.window_repository.calculate_capture_region(win)
        self.screenshot_repository.take_screenshot(path, region)