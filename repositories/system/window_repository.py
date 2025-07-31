import pygetwindow as gw
from repositories.system.i_window_repository import IWindowRepository

class WindowRepository(IWindowRepository):
    def find_window_by_title(self, title: str):
        windows = [w for w in gw.getWindowsWithTitle(title) if not w.isMinimized and w.width > 0]
        return windows[0] if windows else None

    def calculate_capture_region(self, win):
        border_x = 8
        title_bar_height = 30
        border_bottom = 8
        left = win.left + border_x
        top = win.top + title_bar_height
        width = win.width - (border_x * 2)
        height = win.height - (title_bar_height + border_bottom)
        return (left, top, width, height)