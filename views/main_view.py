import threading
from typing import Optional
import flet as ft
import asyncio


from config.config import BATTLE_MODE_ARENA, BATTLE_MODE_ARENA_BP, BATTLE_MODE_BPL, BATTLE_MODE_BPL_BP, RESULT_SOURCE_DAKEN_COUNTER, RESULT_SOURCE_INF_NOTEBOOK
from factories.i_app_factory import IAppFactory
from models.settings import Settings
from utils.common import safe_print
from views.arena_result_table import ArenaResultTable
from views.bpl_result_table import BplResultTable

class MainView:
    def __init__(self, page: ft.Page, factory: IAppFactory):
        self.controller = factory.create_main_view_controller(self)
        
        safe_print("MainView 初期化中")
        self.page = page
        self.result_dir_path = None
        self.resource_timestamp = None
        self.last_result_content = None
        self.settings : Optional[Settings] = None
        self.room_id: Optional[int] = None
        self.user_token : Optional[str] = None
        
        page.window.prevent_close = True
        page.window.on_event = self.window_event
        
        self.result_table_container = ft.Container(
            content=None,
            alignment=ft.alignment.center, 
            padding=10,
            expand=True,
            height=220,
        )
        
        # DJNAME（バリデーション付き）
        self.djname_input = ft.TextField(
            label="DJNAME (最大6文字 半角英数字記号)",
            max_length=6,
            width=200,
            on_change=self.validate_djname
        )

        # ルームパス
        self.room_pass = ft.TextField(
            width=500, max_length=32, label="ルームパスワード", text_align=ft.TextAlign.CENTER,
            input_filter=self.validate_room_pass
        )

        # ルームパス生成ボタン
        self.create_room_pass_button = ft.ElevatedButton(
            "ルームパス生成",
            on_click=self.on_create_room_pass_button,
            width=120,
            bgcolor=ft.Colors.BLUE_400,
            color=ft.Colors.WHITE,
        )

        self.room_pass_row = ft.Row(
            controls=[self.room_pass, self.create_room_pass_button],
            spacing=10,
            vertical_alignment=ft.CrossAxisAlignment.CENTER,
        )
        # モード選択（横並び）
        self.mode_radio = ft.RadioGroup(
            value="1",
            on_change=self.on_mode_change,
            content=ft.Row([
                ft.Radio(value=BATTLE_MODE_ARENA, label="アリーナ"),
                ft.Radio(value=BATTLE_MODE_BPL, label="BPLバトル"),
                ft.Radio(value=BATTLE_MODE_ARENA_BP, label="アリーナ(BP)"),
                ft.Radio(value=BATTLE_MODE_BPL_BP, label="BPL(BP)"),
            ])
        )

        # 定員
        self.user_num_select = ft.Dropdown(
            label="定員",
            options=[ft.dropdown.Option(str(i)) for i in range(2, 5)],
            disabled=False
        )

        self.result_source = ft.RadioGroup(
            content=ft.Row([
                ft.Radio(value=RESULT_SOURCE_DAKEN_COUNTER, label="INFINITAS打鍵カウンタ"),
                ft.Radio(value=RESULT_SOURCE_INF_NOTEBOOK, label="リザルト手帳"),
            ])
        )
        # リザルトファイル選択
        self.result_dir_label = ft.Text("リザルトフォルダ：未選択", size=12)
        self.result_dir_picker = ft.FilePicker(on_result=self.pick_result_dir)
        self.page.overlay.append(self.result_dir_picker)
        self.result_dir_select_btn = ft.ElevatedButton(
            "リザルトフォルダ選択",
            on_click=lambda _: self.result_dir_picker.get_directory_path()
        )

        # 対戦開始/停止ボタン
        self.start_button = ft.FilledButton(
            content=ft.Text("対戦開始", size=20),
            on_click=self.start_battle,
            width=200,
            height=50, 
            disabled=True
        )

        self.stop_button = ft.FilledButton(
            content=ft.Text("対戦終了", size=20),
            on_click=self.stop_battle,
            width=200,
            height=50,
            bgcolor=ft.Colors.RED, 
            visible=False
        )
        
        self.save_path = {"path": None}
        screenshot_file_picker = ft.FilePicker(on_result=self.on_screenshot_save_result)
        page.overlay.append(screenshot_file_picker)

        # 保存ダイアログを開くボタン
        self.save_screenshot_button = ft.ElevatedButton(
            "スクリーンショットを保存",
            on_click=lambda _: screenshot_file_picker.save_file(
                dialog_title="保存先を指定",
                file_name="result.png",
                allowed_extensions=["png"]
            )
        )
 
        self.button_row = ft.Row(
            [self.start_button, self.stop_button, self.save_screenshot_button],
            alignment=ft.MainAxisAlignment.CENTER
        )

        self.setting_group = ft.Container(
            content=ft.Row(
                [
                    # 左カラム：入力情報・対戦設定
                    ft.Column(
                        [
                            # 🎧 入力情報
                            ft.Container(
                                content=ft.Column([
                                    ft.Text("🎧 入力情報", weight=ft.FontWeight.BOLD, size=14),
                                    ft.Container(self.djname_input, width=200),
                                    ft.Container(
                                        ft.Row([
                                            ft.Container(self.room_pass, width=400),
                                            ft.Container(self.create_room_pass_button),
                                        ], spacing=10),
                                        padding=5
                                    ),
                                ]),
                                padding=10,
                                border_radius=10,
                                bgcolor=ft.Colors.GREY_100,
                                border=ft.border.all(1, ft.Colors.GREY_300)
                            ),
                        ],
                        spacing=10,
                        expand=True,
                    ),

                    # 右カラム：📁 リザルト設定
                    ft.Column(
                        [
                            # ⚔️ 対戦設定
                            ft.Container(
                                content=ft.Column([
                                    ft.Text("⚔️ 対戦設定", weight=ft.FontWeight.BOLD, size=14),
                                    ft.Container(
                                        ft.Row([
                                            ft.Container(self.mode_radio),
                                            ft.Container(self.user_num_select)
                                        ], spacing=10),
                                        padding=5
                                    )
                                ]),
                                padding=10,
                                border_radius=10,
                                bgcolor=ft.Colors.GREY_100,
                                border=ft.border.all(1, ft.Colors.GREY_300)
                            ),
                            ft.Container(
                                content=ft.Column([
                                    ft.Text("📁 リザルト設定", weight=ft.FontWeight.BOLD, size=14),
                                    self.result_source,
                                    ft.Row([
                                        self.result_dir_select_btn,
                                        self.result_dir_label,
                                    ], spacing=10),
                                    
                                ]),
                                padding=10,
                                border_radius=10,
                                bgcolor=ft.Colors.GREY_100,
                                border=ft.border.all(1, ft.Colors.GREY_300)
                            )
                        ],
                        spacing=10,
                        expand=True,
                    ),
                ],
                vertical_alignment=ft.CrossAxisAlignment.START,
                spacing=20,
            ),
            padding=10,
            opacity=1.0,
            scale=1.0,
            visible=True,
        )

                
        # ページ追加
        self.page.add(
            ft.Column(
                controls=[
                    self.setting_group,
                    self.button_row,
                    self.result_table_container
                ],
                expand=True,
                spacing=10
            )
        )
        
        # イベントハンドラ登録
        self.djname_input.on_change = self.validate_all_inputs
        self.room_pass.on_change = self.validate_all_inputs
        self.mode_radio.on_change = self.on_mode_change
        self.user_num_select.on_change = self.validate_all_inputs
        self.result_source.on_change = self.validate_all_inputs
        
        # 初期処理の実行
        self.controller.on_create()

    # DJNAMEバリデーション
    def validate_djname(self, e):
        self.controller.validate_djname()

    # RoomPassバリデーション
    def validate_room_pass(self, e):
        self.controller.validate_room_pass()
        
    # ルームパス生成ボタン押下時
    def on_create_room_pass_button(self, e):
        safe_print("ルームパス生成ボタンが呼ばれました")
        self.controller.generate_room_pass()
        

    # メッセージダイアログの表示
    async def show_message_dialog(self, title, message):
        safe_print(f"show_message_dialog: message={message}")

        fut = asyncio.get_event_loop().create_future()

        def on_ok(e):
            self.page.close(dialog)
            if not fut.done():
                fut.set_result(True)

        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text(title),
            content=ft.Text(message),
            actions=[
                ft.TextButton("OK", on_click=on_ok)
            ]
        )

        self.page.open(dialog)
        await fut

    # エラーダイアログの表示
    async def show_error_dialog(self, message):
        safe_print(f"show_error_dialog: message={message}")

        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("エラー"),
            content=ft.Text(message),
            actions=[
                ft.TextButton("OK", on_click=lambda e: self.page.close(dialog))
            ]
        )

        self.page.open(dialog)
        
    # 確認ダイアログの表示
    async def show_confirm_dialog(self, title, message, on_ok_callback):
        safe_print(f"show_confirm_dialog: message={message}")

        fut = asyncio.get_event_loop().create_future()

        def on_ok(e):
            self.page.close(dialog)
            if not fut.done():
                fut.set_result(True)
            if on_ok_callback:
                self.page.run_task(on_ok_callback)

        def on_cancel(e):
            self.page.close(dialog)
            if not fut.done():
                fut.set_result(False)

        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text(title),
            content=ft.Text(message),
            actions=[
                ft.TextButton("キャンセル", on_click=on_cancel),
                ft.FilledButton("OK", bgcolor=ft.Colors.RED, color=ft.Colors.WHITE, on_click=on_ok)
            ]
        )

        self.page.open(dialog)
        await fut
        
    def on_mode_change(self, e):
        self.controller.change_mode()

    def pick_result_dir(self, e: ft.FilePickerResultEvent):
        self.controller.select_result_dir(e)

    def validate_all_inputs(self, e=None):
        self.controller.validate_inputs()

    async def start_battle(self, e):
        await self.controller.start_battle(e)

    async def stop_battle(self, e):
        await self.controller.stop_battle(e)
    
    def on_screenshot_save_result(self, e: ft.FilePickerResultEvent):
        if e.path is None:
            self.page.snack_bar = ft.SnackBar(ft.Text("保存がキャンセルされました"))
            self.page.snack_bar.open = True
            self.page.update()
            return

        self.save_path["path"] = e.path
        self.controller.take_screenshot_and_save(e.path)

    async def async_cleanup(self):
        await self.controller.stop_battle(None)
        
    async def window_event(self, e):
        if e.data == "close":
            await self.on_close()
    
    async def on_close(self):
        safe_print("[on_close] start")
        try:
            await self.controller.stop_battle(None)
        except Exception as ex:
            safe_print(f"[on_close] エラー: {ex}")
        finally:
            safe_print("[on_close] close")
            self.page.window.prevent_close = False
            self.page.window.close()
            # 念のため少し待つ（0.1秒程度）
            await asyncio.sleep(0.1)

            # すべてのタスクをキャンセルして待つ（自分以外）
            tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
            for t in tasks:
                t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            
            for thread in threading.enumerate():
                print(f"[残スレッド] name={thread.name}, daemon={thread.daemon}, ident={thread.ident}")
            
            # 最後の保険
            import os
            os._exit(0)
            
    
    def load_result_table(self, result, is_enable_operation:bool):
        if not result.get("users") or not result.get("songs"):
            self.result_table_container.content = None
            self.page.update()
            return
        
        mode = result.get("mode", BATTLE_MODE_ARENA)
        setting_visible = self.setting_group.visible
        if mode == BATTLE_MODE_ARENA or mode == BATTLE_MODE_ARENA_BP:
            self.result_table_container.content = ArenaResultTable(self.page, result, self._on_skip_song, self._on_delete_song_confirm, setting_visible, is_enable_operation).build()
        else:
            self.result_table_container.content = BplResultTable(self.page, result, self._on_skip_song, self._on_delete_song_confirm, setting_visible, is_enable_operation).build()
        self.page.update()
    
    async def _on_skip_song(self, song_id):
        safe_print(f"スキップ押下: song_id={song_id}")
        await self.controller.skip_song(song_id)
        
    async def _on_delete_song_confirm(self, song_id):
        async def on_ok():
            safe_print(f"削除確定: song_id={song_id}")
            await self.controller.delete_song(song_id)

        await self.show_confirm_dialog(
            "削除確認",
            "本当にこの対戦を削除しますか？",
            on_ok_callback=on_ok
        )