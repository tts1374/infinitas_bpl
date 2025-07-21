import flet as ft
from repositories.db.migrations import init_db
from factories.app_factory import AppFactory
from views.main_view import MainView
import traceback

from utils.common import resource_path, safe_print

def main(page: ft.Page):
    try:
        init_db()

        page.title = "INFINITAS オンライン対戦"
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