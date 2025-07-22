import asyncio
import os
import json
import re
import uuid

from controllers.i_app_controller import IAppController
from controllers.i_main_view_controller import IMainViewController
from errors.connection_failed_error import ConnectionFailedError
from models.settings import Settings
from repositories.files.file_watcher import FileWatcher
from utils.common import safe_print
from watchdog.observers import Observer
import flet as ft

import json
from views.main_view import MainView

DB_FILE = "result.db"
RESULT_FILE = "result_output.json"

class MainViewController(IMainViewController):
    def __init__(self, app: MainView, app_controller: IAppController):
        self.app = app
        self.app_controller = app_controller
        self.last_result_content = None

    def on_create(self):
        # アップデートのチェック
        self.app.page.run_task(self._check_for_update)
        
        # 設定のロード
        settings = self.app_controller.load_settings()

        self.app.djname_input.value = settings.djname
        self.app.room_pass.value = settings.room_pass
        self.app.mode_radio.value = settings.mode

        if settings.mode in ["2", "4"]:
            self.app.user_num_select.disabled = True
            self.app.user_num_select.value = "2"
        else:
            self.app.user_num_select.disabled = False
            self.app.user_num_select.value = settings.user_num

        if settings.result_file:
            file_name = os.path.basename(settings.result_file)
            self.app.result_file_path = settings.result_file
            self.app.result_file_label.value = f"リザルトファイル：{file_name}"
        else:
            self.app.result_file_label.value = "リザルトファイル：未選択"

        self.validate_inputs()
        self.app.page.update()

    # DJNAMEバリデーション
    def validate_djname(self, e):
        pattern = r'^[a-zA-Z0-9.\-*&!?#$]*$'
        if not re.fullmatch(pattern, self.app.djname_input.value):
            self.app.djname_input.error_text = "使用可能文字：a-z A-Z 0-9 .- *&!?#$"
        else:
            self.app.djname_input.error_text = None
        self.app.page.update()

    # RoomPassバリデーション
    def validate_room_pass(self, e):
        pattern = r'^[a-zA-Z0-9_-]{4,36}$'
        if not re.fullmatch(pattern, self.app.room_pass.value):
            self.app.room_pass.error_text = "使用可能文字：a-z A-Z 0-9 -_ 4～36文字"
        else:
            self.app.room_pass.error_text = None
        self.app.page.update()

    def change_mode(self):
        mode = self.app.mode_radio.value
        if mode in ["1", "3"]:
            self.app.user_num_select.disabled = False
        else:
            self.app.user_num_select.disabled = True
        self.app.page.update()

    def select_result_file(self, e):
        if e.files:
            self.app.result_file_path = e.files[0].path
            file_name = os.path.basename(self.app.result_file_path)
            self.app.result_file_label.value = f"リザルトファイル：{file_name}"
        else:
            self.app.result_file_path = None
            self.app.result_file_label.value = "リザルトファイル：未選択"
        self.validate_inputs()

    def validate_inputs(self):
        djname_ok = re.fullmatch(r'^[a-zA-Z0-9.\-\*&!?#$]{1,6}$', self.app.djname_input.value or "") is not None
        room_pass_ok = re.fullmatch(r'^[a-zA-Z0-9_-]{4,36}$', self.app.room_pass.value or "") is not None
        file_ok = self.app.result_file_path is not None

        mode = self.app.mode_radio.value
        user_num_ok = (mode in ["2", "4"]) or (self.app.user_num_select.value is not None)

        can_start = djname_ok and room_pass_ok and file_ok and user_num_ok

        self.app.start_button.disabled = not can_start
        self.app.page.update()

    async def start_battle(self, e):
        # UI更新：多重起動防止とProgressRing表示
        self.app.start_button.disabled = True
        self.app.start_button.content = ft.ProgressRing(width=30, height=30, stroke_width=4)
        self.app.page.update()
        
        try:
            # 設定ファイル保存
            mode_value = int(self.app.mode_radio.value)
            user_num = 2 if mode_value in [2, 4] else int(self.app.user_num_select.value)

            settings = Settings(
                djname=self.app.djname_input.value,
                room_pass=self.app.room_pass.value,
                mode=mode_value,
                user_num=user_num,
                result_file=self.app.result_file_path
            )
            self.app.user_token = await self.app_controller.start_battle(settings, self._load_result_table)
            self.app.settings = settings
            
            # ファイル監視
            self.file_watch_service = FileWatcher(self)
            self.observer = Observer()
            self.observer.schedule(self.file_watch_service, path=os.path.dirname(self.app.result_file_path), recursive=False)
            self.observer.start()
            
            self.app.start_button.visible = False
            self.app.stop_button.visible = True

        except ConnectionFailedError as e:
            await self.app.show_error_dialog(f"{e}")
            self.app.start_button.disabled = False
            self.app.start_button.content = ft.Text("対戦開始", size=20)
        except Exception as ex:
            # エラーハンドリング（必要に応じて表示）
            safe_print("[エラー] start_battle:", ex)

            # エラー発生時はボタンを元に戻す
            self.app.start_button.disabled = False
            self.app.start_button.content = ft.Text("対戦開始", size=20)

        else:
            # 成功時はstop_buttonのみ有効にする（startは非表示）
            pass

        finally:
            self.app.page.update()

    async def stop_battle(self, e):
        if not self.app.stop_button.visible:
            # 既に停止済みの場合は何もしない
            return
        
        await self.app_controller.stop_battle()

        if hasattr(self, "observer"):
            self.observer.stop()
            self.observer.join()
            safe_print("observer stop")

        self.app.start_button.visible = True
        self.app.start_button.disabled = False
        self.app.start_button.content = ft.Text("対戦開始", size=20)

        self.app.stop_button.visible = False

        self.app.page.update()

    async def skip_song(self, song_id): 
        await self.app_controller.skip_song(self.app.user_token, self.app.settings, song_id)

    def generate_room_pass(self):
        new_uuid = str(uuid.uuid4()).replace("-", "")
        self.app.room_pass.value = new_uuid
        self.validate_inputs()
        self.app.page.update()
    
    ##############################
    ## private
    ##############################
    async def _check_for_update(self):
        safe_print("アップデートのチェック")
        result, assets = self.app_controller.check_update()

        if result.error:
            await self.app.show_error_dialog(f"アップデート確認エラー: {result.error}")
            return

        if result.need_update:
            await self.app.show_message_dialog("アップデート", "新しいバージョンが見つかりました。アップデートします。")
            safe_print("execute update")
            err = self.app_controller.perform_update(assets, self.app.page.run_task(self._close))
            if err:
                await self.app.show_error_dialog(f"アップデート失敗: {err}")
    
    async def _close(self):
        self.app.on_close()
    
    async def _file_watch_callback(self, content):
        await self.app_controller.result_send(self.app.user_token, self.app.settings, content)
        
    def _load_result_table(self):
        if not os.path.exists(RESULT_FILE):
            return

        with open(RESULT_FILE, "r", encoding="utf-8") as f:
            result = json.load(f)

        if not result.get("users") or not result.get("songs"):
            return
        self.app.load_result_table(result)