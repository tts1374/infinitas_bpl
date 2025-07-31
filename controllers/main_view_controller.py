import asyncio
import os
import re
import time
import uuid

from application.i_main_app_service import IMainAppSerivce
from config.config import BATTLE_MODE_BPL, BATTLE_MODE_BPL_BP
from controllers.i_main_view_controller import IMainViewController
from errors.connection_failed_error import ConnectionFailedError
from models.settings import Settings
from repositories.files.file_watcher import FileWatcher
from utils.common import safe_int, safe_print
from watchdog.observers import Observer
import flet as ft

class MainViewController(IMainViewController):
    def __init__(self, app, main_app_serivce: IMainAppSerivce):
        self.app = app
        self.main_app_serivce = main_app_serivce
        self.last_result_content = None

    def on_create(self):
        # アップデートのチェック
        self.app.page.run_task(self._check_for_update)
        
        # 出力ファイルのクリア
        self.main_app_serivce.initialize_output_file()
        
        # 設定のロード
        settings = self.main_app_serivce.load_settings()

        self.app.djname_input.value = settings.djname
        self.app.room_pass.value = settings.room_pass
        self.app.mode_radio.value = settings.mode
        self.app.result_source.value = settings.result_source
        self.app.resource_timestamp = settings.resource_timestamp

        if int(settings.mode) in [BATTLE_MODE_BPL, BATTLE_MODE_BPL_BP]:
            self.app.user_num_select.disabled = True
            self.app.user_num_select.value = "2"
        else:
            self.app.user_num_select.disabled = False
            self.app.user_num_select.value = settings.user_num

        if settings.result_dir:
            dir_name = settings.result_dir
            self.app.result_dir_path = settings.result_dir
            self.app.result_dir_label.value = f"リザルトフォルダ：{dir_name}"
        else:
            self.app.result_dir_label.value = "リザルトフォルダ：未選択"

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

    def select_result_dir(self, e: ft.FilePickerResultEvent):
        if e.path:
            self.app.result_dir_label.value = f"リザルトフォルダ：{e.path}"
            self.app.result_dir_path = e.path
        else:
            self.app.result_dir_label.value = "リザルトフォルダ：未選択"
            self.app.result_dir_path = None
        self.validate_inputs()

    def validate_inputs(self):
        mode_value = safe_int(self.app.mode_radio.value)
        user_num = 2 if mode_value in [BATTLE_MODE_BPL, BATTLE_MODE_BPL_BP] else safe_int(self.app.user_num_select.value)
        result_source = safe_int(self.app.result_source.value)
        
        settings = Settings(
            djname=self.app.djname_input.value,
            room_pass=self.app.room_pass.value,
            mode=mode_value,
            user_num=user_num,
            result_source=result_source,
            result_dir=self.app.result_dir_path,
            resource_timestamp=self.app.resource_timestamp
        )

        self.app.start_button.disabled = not settings.is_valid()
        self.app.page.update()

    async def start_battle(self, e):
        # UI更新：多重起動防止とProgressRing表示
        self.app.setting_group.visible = False
        self.app.start_button.disabled = True
        self.app.start_button.content = ft.ProgressRing(width=30, height=30, stroke_width=4)
        self._input_disable()
        self._load_result_table()
        self.app.page.update()
        await asyncio.sleep(0.1)
        
        try:
            # 設定ファイル保存
            mode_value = int(self.app.mode_radio.value)
            user_num = 2 if mode_value in [BATTLE_MODE_BPL, BATTLE_MODE_BPL_BP] else int(self.app.user_num_select.value)
            result_source = int(self.app.result_source.value)
            
            settings = Settings(
                djname=self.app.djname_input.value,
                room_pass=self.app.room_pass.value,
                mode=mode_value,
                user_num=user_num,
                result_source=result_source,
                result_dir=self.app.result_dir_path,
                resource_timestamp=self.app.resource_timestamp
            )
            # マスタデータの更新
            new_timestamp = self.main_app_serivce.update_master_data(settings)
            if new_timestamp is not None:
                self.app.resource_timestamp = new_timestamp
                settings.resource_timestamp = new_timestamp
            
            # websocketに接続
            self.app.room_id, self.app.user_token = await self.main_app_serivce.start_battle(settings, self._load_result_table)
            self.app.settings = settings
            
            # ファイル監視
            self.file_watch_service = FileWatcher(self)
            self.observer = Observer()
            self.observer.schedule(self.file_watch_service, path=os.path.dirname(self.app.settings.get_result_file()), recursive=False)
            self.observer.start()
            
            self.app.start_button.visible = False
            self.app.stop_button.visible = True

        except ConnectionFailedError as e:
            await self.app.show_error_dialog(f"{e}")
            self._input_enable()
            self.app.setting_group.visible = True
            self.app.start_button.disabled = False
            self.app.start_button.content = ft.Text("対戦開始", size=20)
        except Exception as ex:
            # エラーハンドリング（必要に応じて表示）
            safe_print("[エラー] start_battle:", ex)

            # エラー発生時はボタンを元に戻す
            self._input_enable()
            self.app.setting_group.visible = True
            self.app.start_button.disabled = False
            self.app.start_button.content = ft.Text("対戦開始", size=20)

        else:
            # 成功時はstop_buttonのみ有効にする（startは非表示）
            pass

        finally:
            self.app.page.update()
            self._load_result_table()

    async def stop_battle(self, e):
        if not self.app.stop_button.visible:
            # 既に停止済みの場合は何もしない
            return
        # Websocketの停止
        await self.main_app_serivce.stop_battle()
        # ファイル監視の停止
        if hasattr(self, "observer"):
            self.observer.stop()
            self.observer.join()
            safe_print("observer stop")

        self._input_enable()
        self.app.setting_group.visible = True
        self.app.start_button.visible = True
        self.app.start_button.disabled = False
        self.app.start_button.content = ft.Text("対戦開始", size=20)

        self.app.stop_button.visible = False
        self._load_result_table()
        self.app.page.update()

    async def skip_song(self, song_id): 
        await self.main_app_serivce.skip_song(self.app.room_id, self.app.user_token, self.app.settings, song_id)

    async def delete_song(self, song_id: int):
        await self.main_app_serivce.delete_song(self.app.room_id, self.app.user_token, self.app.settings, song_id)
        
    def generate_room_pass(self):
        new_uuid = str(uuid.uuid4()).replace("-", "")
        self.app.room_pass.value = new_uuid
        self.validate_inputs()
        self.app.page.update()   
    
    def take_screenshot_and_save(self, path:str):
        try:
            # 画面調整(スクショ範囲外の非表示)
            settings_visible = self.app.setting_group.visible
            self.app.button_row.visible = False
            self.app.setting_group.visible = False
            if self.app.result_table_container.content is not None:
                self._load_result_table(is_enable_operation=False)
            self.app.page.update()
            time.sleep(0.5)
            
            self.main_app_serivce.take_screenshot(path, self.app.page.title)

            # 非表示部分の戻し
            self.app.setting_group.visible = settings_visible
            self.app.button_row.visible = True
            if self.app.result_table_container.content is not None:
                self._load_result_table()

            self.app.page.open(ft.SnackBar(ft.Text(f"保存しました: {path}")))
            self.app.page.update()
        except Exception as ex:
            safe_print(f"[take_screenshot_and_save] エラー: {ex}")
    
    ##############################
    ## private
    ##############################
    def _input_disable(self):
        self.app.djname_input.disabled = True
        self.app.room_pass.disabled = True
        self.app.mode_radio.disabled = True
        self.app.user_num_select.disabled = True
        self.app.create_room_pass_button.disabled = True
        self.app.result_dir_select_btn.disabled = True
        
    def _input_enable(self):
        # 入力・選択・押下を可能にする
        self.app.djname_input.disabled = False
        self.app.room_pass.disabled = False
        self.app.mode_radio.disabled = False

        mode = self.app.mode_radio.value
        if mode in ["2", "4"]:
            self.app.user_num_select.disabled = True
        else:
            self.app.user_num_select.disabled = False

        self.app.create_room_pass_button.disabled = False
        self.app.result_dir_select_btn.disabled = False

    async def _check_for_update(self):
        safe_print("アップデートのチェック")
        result, assets = self.main_app_serivce.check_update()

        if result.error:
            await self.app.show_error_dialog(f"アップデート確認エラー: {result.error}")
            return

        if result.need_update:
            await self.app.show_message_dialog("アップデート", "新しいバージョンが見つかりました。アップデートします。")
            safe_print("execute update")
            err = self.main_app_serivce.perform_update(assets, lambda: self.app.page.run_task(self._close))
            if err:
                await self.app.show_error_dialog(f"アップデート失敗: {err}")
    
    async def _close(self):
        await self.app.on_close()
    
    async def _file_watch_callback(self, content):
        await self.main_app_serivce.result_send(self.app.user_token, self.app.settings, content)
        
    def _load_result_table(self, is_enable_operation:bool = True):
        result = self.main_app_serivce.load_output_file() 
        self.app.load_result_table(result, is_enable_operation)