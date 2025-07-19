import os
import json
import re

from services import update_service
from utils.common import safe_print
from utils.result_handler import ResultHandler
from watchdog.observers import Observer
from services.db_service import DBService
from services.result_service import ResultService
from handlers.websocket_handler import WebSocketHandler
import flet as ft

DB_FILE = "result.db"

class BattleHandler:
    def __init__(self, app):
        self.app = app
        self.websocket_handler = None

    def on_mode_change(self):
        mode = self.app.mode_radio.value
        if mode in ["1", "3"]:
            self.app.user_num_select.disabled = False
        else:
            self.app.user_num_select.disabled = True
        self.app.page.update()

    def pick_result_file(self, e):
        if e.files:
            self.app.result_file_path = e.files[0].path
            file_name = os.path.basename(self.app.result_file_path)
            self.app.result_file_label.value = f"リザルトファイル：{file_name}"
        else:
            self.app.result_file_path = None
            self.app.result_file_label.value = "リザルトファイル：未選択"
        self.validate_all_inputs()

    def validate_all_inputs(self):
        djname_ok = re.fullmatch(r'^[a-zA-Z0-9.\-\*&!?#$]{1,6}$', self.app.djname_input.value or "") is not None
        room_pass_ok = self.app.room_pass1.value.isdigit() and len(self.app.room_pass1.value) == 4 and \
                       self.app.room_pass2.value.isdigit() and len(self.app.room_pass2.value) == 4
        file_ok = self.app.result_file_path is not None

        mode = self.app.mode_radio.value
        user_num_ok = (mode in ["2", "4"]) or (self.app.user_num_select.value is not None)

        can_start = djname_ok and room_pass_ok and file_ok and user_num_ok

        self.app.start_button.disabled = not can_start
        self.app.page.update()

    def load_settings(self):
        if os.path.exists("settings.json"):
            with open("settings.json", "r", encoding="utf-8") as f:
                self.app.settings = json.load(f)

            self.app.djname_input.value = self.app.settings.get("djname", "")
            room_pass = self.app.settings.get("room_pass", "0000-0000").split("-")
            if len(room_pass) == 2:
                self.app.room_pass1.value, self.app.room_pass2.value = room_pass

            mode_value = str(self.app.settings.get("mode", "1"))
            self.app.mode_radio.value = mode_value

            if mode_value in ["2", "4"]:
                self.app.user_num_select.disabled = True
                self.app.user_num_select.value = "2"
            else:
                self.app.user_num_select.disabled = False
                self.app.user_num_select.value = str(self.app.settings.get("user_num", "2"))

            self.app.result_file_path = self.app.settings.get("result_file")
            if self.app.result_file_path:
                file_name = os.path.basename(self.app.result_file_path)
                self.app.result_file_label.value = f"リザルトファイル：{file_name}"
            else:
                self.app.result_file_label.value = "リザルトファイル：未選択"

            self.validate_all_inputs()
            self.app.page.update()

    def save_settings(self):
        mode_value = int(self.app.mode_radio.value)
        user_num = 2 if mode_value in [2, 4] else int(self.app.user_num_select.value)

        self.app.settings = {
            "djname": self.app.djname_input.value,
            "room_pass": f"{self.app.room_pass1.value}-{self.app.room_pass2.value}",
            "mode": mode_value,
            "user_num": user_num,
            "result_file": self.app.result_file_path
        }
        with open("settings.json", "w", encoding="utf-8") as f:
            json.dump(self.app.settings, f, ensure_ascii=False, indent=4)

    async def start_battle(self, e):
        self.save_settings()

        # UI更新：多重起動防止とProgressRing表示
        self.app.start_button.disabled = True
        self.app.start_button.content = ft.ProgressRing(width=30, height=30, stroke_width=4)
        self.app.page.update()

        try:
            db = DBService(DB_FILE)
            self.app.room_id, self.app.user_token = db.register_room_and_user(self.app.settings)

            # WebSocket接続
            self.websocket_handler = WebSocketHandler(self.app, db)
            await self.websocket_handler.connect()

            # ファイル監視開始
            self.result_handler = ResultHandler(self)
            self.observer = Observer()
            self.observer.schedule(self.result_handler, path=os.path.dirname(self.app.result_file_path), recursive=False)
            self.observer.start()

            self.app.start_button.visible = False
            self.app.stop_button.visible = True

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
        if self.websocket_handler:
            await self.websocket_handler.disconnect()
            safe_print("Websocket disconnect")

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
        db = DBService(DB_FILE)
        song = db.get_song_by_id(song_id)

        # 難易度変換マップ
        diff_map = {
            "BEGINNER": "B",
            "NORMAL": "N",
            "HYPER": "H",
            "ANOTHER": "A",
            "LEGGENDARIA": "L"
        }

        # play_style変換
        if song["play_style"] == "DB":
            converted_playstyle = "DP"
        else:
            converted_playstyle = song["play_style"]

        # difficulty変換
        converted_difficulty = f"{converted_playstyle}{diff_map.get(song['difficulty'], '?')}"

        # opt変換
        converted_opt = "BATTLE" if song["play_style"] == "DB" else ""

        result_data = {
            "mode": self.app.settings['mode'],
            "roomId": self.app.settings['room_pass'],
            "userId": self.app.user_token,
            "name": self.app.settings['djname'],
            "result": {
                "lv": str(song["level"]),
                "title": song["song_name"],
                "difficulty": converted_difficulty,
                "dp_unofficial_lv": None,
                "sp_12hard": None,
                "sp_12clear": None,
                "lamp": "FAILED",
                "score": "0",
                "opt": converted_opt,
                "bp": "9999",
                "bpi": "??",
                "notes": str(song["notes"]),
                "score_cur": "0",
                "score_pre": "0",
                "lamp_pre": "FAILED",
                "bp_pre": "0",
                "rank_pre": "F",
                "rank": "F",
                "rankdiff": "F+0",
                "rankdiff0": "F",
                "rankdiff1": "+0",
                "scorerate": "0"
            }
        }
        safe_print("[送信データ]")
        safe_print(json.dumps(result_data, ensure_ascii=False, indent=2))
        await self.websocket_handler.send(result_data)


    async def handle_result_update(self, content):
        service = ResultService(self.app.settings, self.app.user_token)
        result_data = service.parse_result(content)
        safe_print("[送信データ]")
        safe_print(json.dumps(result_data, ensure_ascii=False, indent=2))
        await self.websocket_handler.send(result_data)
        
    async def check_for_update(self):
        result, assets = update_service.check_update()

        if result.error:
            await self.app.show_error_dialog(f"アップデート確認エラー: {result.error}")
            return

        if result.need_update:
            await self.app.show_message_dialog("アップデート", "新しいバージョンが見つかりました。アップデートします。")
            safe_print("execute update")
            err = update_service.perform_update(assets)
            if err:
                await self.app.show_error_dialog(f"アップデート失敗: {err}")