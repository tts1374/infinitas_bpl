from watchdog.events import FileSystemEventHandler

from utils.common import safe_print

class ResultHandler(FileSystemEventHandler):
    def __init__(self, battle_handler):
        self.battle_handler = battle_handler

    def on_modified(self, event):
        app = self.battle_handler.app

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
            asyncio.run(self.battle_handler.handle_result_update(content))

        except Exception as e:
            safe_print(f"[watchdog] ファイル読み込みエラー: {e}")