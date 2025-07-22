from typing import Optional
import flet as ft
import re
import asyncio
import os
import json
import sys
from factories.i_app_factory import IAppFactory
from models.settings import Settings
from utils.common import safe_print

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
        
        self.result_table_container = ft.Container()
        
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
                ft.Radio(value="1", label="アリーナ"),
                ft.Radio(value="2", label="BPLバトル"),
                ft.Radio(value="3", label="アリーナ(BP)"),
                ft.Radio(value="4", label="BPL(BP)"),
            ])
        )

        # 定員
        self.user_num_select = ft.Dropdown(
            label="定員",
            options=[ft.dropdown.Option(str(i)) for i in range(2, 5)],
            disabled=False
        )

        # リザルトファイル選択
        self.result_file_label = ft.Text("リザルトファイル：未選択", size=12)
        self.result_file_button = ft.FilePicker(on_result=self.pick_result_file)
        self.page.overlay.append(self.result_file_button)
        self.result_file_select_btn = ft.ElevatedButton(
            "リザルトファイル選択 (.xmlのみ)",
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

        mode_usernum_group = ft.Row([
            ft.Container(self.mode_radio),
            ft.Container(self.user_num_select, width=100)  # 定員ドロップダウンの幅を固定
        ], vertical_alignment=ft.CrossAxisAlignment.CENTER)
        result_file_group = ft.Row([
            self.result_file_select_btn,
            self.result_file_label
        ], vertical_alignment=ft.CrossAxisAlignment.CENTER)    
        button_row = ft.Row(
            [self.start_button, self.stop_button],
            alignment=ft.MainAxisAlignment.CENTER
        )
        self.page.add(
            ft.ResponsiveRow(
                controls=[
                    ft.Container(self.djname_input, col={"sm": 12, "md": 12}),
                    ft.Container(self.room_pass_row, col={"sm": 12, "md": 12}),
                    ft.Container(mode_usernum_group, col={"sm": 12, "md": 12}),
                    ft.Container(result_file_group, col={"sm": 12, "md": 4}),
                    ft.Container(button_row, col={"sm": 12, "md": 12}),
                    ft.Container(self.result_table_container, col={"sm": 12, "md": 12}, expand=True),
                ],
                spacing=10,
                run_spacing=10
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
    
    async def on_skip_song(self, song_id):
        safe_print(f"スキップ押下: song_id={song_id}")
        await self.controller.skip_song(song_id)
        
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

        headers = ["No.", "曲名"] + [user["user_name"] for user in result["users"]] + ["スキップ", "削除"]

        data_rows = []

        for song in result["songs"]:
            row_cells = []
            row_cells.append(ft.DataCell(ft.Text(str(song.get("stage_no", song["song_id"])))))
            row_cells.append(ft.DataCell(ft.Text(f"{song['song_name']}\n({song['play_style']} {song['difficulty']})")))

            for user in result["users"]:
                user_result = next((r for r in song["results"] if r["user_id"] == user["user_id"]), None)
                if user_result:
                    if result["mode"] in [1,2]:
                        score = user_result["score"]
                        if len(result["users"]) > 1 and len(song["results"]) == len(result["users"]):
                            pt = user_result["pt"]
                            cell_text = f"{score}\n{('〇' if pt == 1 else '×') if result['mode']==2 else str(pt)+'pt'}"
                        else:
                            cell_text = f"{score}"
                    else:
                        miss = user_result["miss_count"]
                        if len(result["users"]) > 1 and len(song["results"]) == len(result["users"]):
                            pt = user_result["pt"]
                            cell_text = f"{miss}\n{('〇' if pt == 1 else '×') if result['mode']==4 else str(pt)+'pt'}"
                        else:
                            cell_text = f"{miss}"
                    row_cells.append(ft.DataCell(ft.Text(cell_text)))
                else:
                    row_cells.append(ft.DataCell(ft.Text("-")))

            # スキップボタン
            if any(r["user_id"] == result["users"][0]["user_id"] for r in song["results"]):
                row_cells.append(ft.DataCell(ft.Text("")))
            else:
                skip_button = ft.FilledButton(
                    text="スキップ",
                    bgcolor=ft.Colors.AMBER,  # 黄色
                    color=ft.Colors.BLACK,
                    on_click=lambda e, song_id=song["song_id"]: self.page.run_task(self.on_skip_song, song_id)
                )
                row_cells.append(ft.DataCell(skip_button))

            # 削除ボタン
            delete_button = ft.FilledButton(
                text="削除",
                bgcolor=ft.Colors.RED,
                color=ft.Colors.WHITE,
                on_click=lambda e, song_id=song["song_id"]: self.page.run_task(self._on_delete_song_confirm, song_id)
            )
            row_cells.append(ft.DataCell(delete_button))

            data_rows.append(ft.DataRow(cells=row_cells))

        data_table = ft.DataTable(
            columns=[ft.DataColumn(ft.Text(h)) for h in headers],
            rows=data_rows,
            column_spacing=20,
            expand=True
        )

        self.result_table_container.content = ft.Container(
            content=ft.Column([data_table], scroll=ft.ScrollMode.AUTO),
            padding=10,
            expand=True
        )

        self.page.update()

    async def _on_delete_song_confirm(self, song_id):
        async def on_ok():
            safe_print(f"削除確定: song_id={song_id}")
            await self.controller.delete_song(song_id)

        await self.show_confirm_dialog(
            "削除確認",
            "本当にこの対戦を削除しますか？",
            on_ok_callback=on_ok
        )