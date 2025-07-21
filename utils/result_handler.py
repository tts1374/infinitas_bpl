from watchdog.events import FileSystemEventHandler

from utils.common import safe_print

class ResultHandler(FileSystemEventHandler):
    def __init__(self, main_view_controller):
        self.main_view_controller = main_view_controller

    def on_modified(self, event):
        app = self.main_view_controller.app

        if event.src_path != app.result_file_path:
            return

        try:
            with open(app.result_file_path, "r", encoding="utf-8") as f:
                content = f.read()

            if content == app.last_result_content:
                return

            app.last_result_content = content

            # BattleHandler経由でリザルト処理を呼ぶ
            import asyncio
            asyncio.run(self.main_view_controller.handle_result_update(content))

        except Exception as e:
            safe_print(f"[watchdog] ファイル読み込みエラー: {e}")