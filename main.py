import flet as ft
from db.database import init_db
from models.arena_app import ArenaApp
import traceback

from utils.common import resource_path, safe_print

def main(page: ft.Page):
    try:
        init_db()

        page.title = "INFINITAS オンライン対戦"
        # ソフトウェアアイコンの設定
        page.window.icon = resource_path("images/icon.ico")
        app = ArenaApp(page)
        app.load_settings()
    except Exception as e:
        # エラーログ出力
        with open("error.log", "w", encoding="utf-8") as f:
            f.write("予期せぬエラーが発生しました:\n")
            traceback.print_exc(file=f)
        # さらにコンソールにも出す（開発時用）
        safe_print("例外発生！ error.logを確認してください。")
        raise e


ft.app(target=main)