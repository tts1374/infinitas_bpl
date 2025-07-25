from typing import Optional
import flet as ft
import asyncio
import flet_webview as ftwv
from config.config import BATTLE_MODE_ARENA, BATTLE_MODE_ARENA_BP, BATTLE_MODE_BPL, BATTLE_MODE_BPL_BP, RESULT_SOURCE_DAKEN_COUNTER, RESULT_SOURCE_INF_NOTEBOOK
from factories.i_app_factory import IAppFactory
from models.settings import Settings
from utils.common import safe_int, safe_print
from views.arena_result_table import ArenaResultTable
from views.bpl_result_table import BplResultTable

class MainView:
    def __init__(self, page: ft.Page, factory: IAppFactory):
        self.controller = factory.create_main_view_controller(self)
        
        safe_print("MainView 初期化中")
        self.page = page
        self.result_file_path = None
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
            on_change=self._on_result_source_change_and_file_clear,
            content=ft.Row([
                ft.Radio(value=RESULT_SOURCE_DAKEN_COUNTER, label="INFINITAS打鍵カウンタ"),
                ft.Radio(value=RESULT_SOURCE_INF_NOTEBOOK, label="リザルト手帳"),
            ])
        )
        # リザルトファイル選択
        self.result_file_label = ft.Text("リザルトファイル：未選択", size=12)
        self.result_file_button = ft.FilePicker(on_result=self.pick_result_file)
        self.page.overlay.append(self.result_file_button)
        self.result_file_select_btn = ft.ElevatedButton(
            "リザルトファイル選択 (today_update.xml)",
            on_click=lambda _: self.result_file_button.pick_files(
                file_type=ft.FilePickerFileType.CUSTOM,
                allowed_extensions=["xml"],
                allow_multiple=False
            )
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
 
        button_row = ft.Row(
            [self.start_button, self.stop_button],
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
                                        self.result_file_select_btn,
                                        self.result_file_label,
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
                    button_row,
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

    def pick_result_file(self, e: ft.FilePickerResultEvent):
        self.controller.select_result_file(e)

    def validate_all_inputs(self, e=None):
        self.controller.validate_inputs()

    async def start_battle(self, e):
        await self.controller.start_battle(e)

    async def stop_battle(self, e):
        await self.controller.stop_battle(e)

    async def async_cleanup(self):
        await self.controller.stop_battle(None)
        
    async def window_event(self, e):
        if e.data == "close":
            await self.on_close()
    
    async def on_close(self):
        safe_print("[on_close] start")
        try:
            await self.controller.stop_battle(None)
            
            for task in asyncio.all_tasks():
                safe_print(f"残タスク: {task}")
        except Exception as ex:
            safe_print(f"[on_close] エラー: {ex}")
        finally:
            safe_print("[on_close] close")
            self.page.window.prevent_close = False
            self.page.window.close()
            
    
    def load_result_table(self, result):
        if not result.get("users") or not result.get("songs"):
            self.result_table_container.content = None
            self.page.update()
            return
        
        mode = result.get("mode", BATTLE_MODE_ARENA)
        setting_visible = self.setting_group.visible
        if mode == BATTLE_MODE_ARENA or mode == BATTLE_MODE_ARENA_BP:
            self.result_table_container.content = ArenaResultTable(self.page, result, self._on_skip_song, self._on_delete_song_confirm, setting_visible).build()
        else:
            self.result_table_container.content = BplResultTable(self.page, result, self._on_skip_song, self._on_delete_song_confirm, setting_visible).build()
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
    def _on_result_source_change_and_file_clear(self, e):
        self.result_file_path = None
        self.last_result_content = None
        self.result_file_label.value = "リザルトファイル：未選択"
        self.on_result_source_change()
        
    # リザルト取得手段変更
    def on_result_source_change(self):
        result_source = safe_int(self.result_source.value, RESULT_SOURCE_DAKEN_COUNTER)
        # 選択内容に応じてボタンとFilePicker拡張子を更新
        self.result_file_select_btn.text = (
            "リザルトファイル選択 (recent.json)"
            if result_source == RESULT_SOURCE_INF_NOTEBOOK
            else "リザルトファイル選択 (today_update.xml)"
        )

        self.result_file_select_btn.on_click = lambda _: self.result_file_button.pick_files(
            file_type=ft.FilePickerFileType.CUSTOM,
            allowed_extensions=["json"] if result_source == RESULT_SOURCE_INF_NOTEBOOK else ["xml"],
            allow_multiple=False
        )

        self.page.update()