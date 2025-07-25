import flet as ft
from repositories.db.migrations import run_migrations
from factories.app_factory import AppFactory
from views.main_view import MainView
import traceback

from utils.common import resource_path, safe_print

def main(page: ft.Page):
    try:
        run_migrations()

        page.title = "INFINITAS オンライン対戦"
        page.window.width = 1200
        page.window.height = 900
        page.window.min_width = 1200
        page.window.min_height = 900
        # ソフトウェアアイコンの設定
        page.window.icon = resource_path("icon.ico")
        
        factory = AppFactory()
        MainView(page, factory)
    except Exception as e:
        # エラーログ出力
        with open("error.log", "w", encoding="utf-8") as f:
            f.write("予期せぬエラーが発生しました:\n")
            traceback.print_exc(file=f)
        # さらにコンソールにも出す（開発時用）
        safe_print("例外発生！ error.logを確認してください。")
        raise e


ft.app(target=main, assets_dir="assets")