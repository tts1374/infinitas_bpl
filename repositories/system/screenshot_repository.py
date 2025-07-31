import time
import pyautogui

from repositories.system.i_screenshot_repository import IScreenshotRepository

class ScreenshotRepository(IScreenshotRepository):
    def take_screenshot(self, path: str, region: tuple):
        time.sleep(0.5)  # UI反映待ち
        pyautogui.screenshot(region=region).save(path)