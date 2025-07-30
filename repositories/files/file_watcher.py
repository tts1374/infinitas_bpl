from watchdog.events import FileSystemEventHandler

from models.settings import Settings
from utils.common import safe_print

class FileWatcher(FileSystemEventHandler):
    def __init__(self, main_view_controller):
        self.main_view_controller = main_view_controller

    def on_modified(self, event):
        app = self.main_view_controller.app
        settings: Settings = app.settings

        if event.src_path != settings.get_result_file():
            return

        try:
            with open(settings.get_result_file(), "r", encoding="utf-8") as f:
                content = f.read()

            if content == app.last_result_content:
                return

            app.last_result_content = content

            # BattleHandler経由でリザルト処理を呼ぶ
            import asyncio
            asyncio.run(self.main_view_controller._file_watch_callback(content))

        except Exception as e:
            safe_print(f"[watchdog] ファイル読み込みエラー: {e}")