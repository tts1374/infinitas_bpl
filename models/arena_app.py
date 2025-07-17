import flet as ft
import re
import asyncio
import os
import json
import sys
from handlers.battle_handler import BattleHandler

DB_FILE = "result.db"
SETTINGS_FILE = "settings.json"
RESULT_FILE = "result_output.json"

class ArenaApp:
    def __init__(self, page: ft.Page):
        self.page = page
        self.page.on_close = self.on_close
        self.result_file_path = None
        self.last_result_content = None
        self.battle_handler = BattleHandler(self)
        self.result_table_container = ft.Container()
        
        # DJNAME（バリデーション付き）
        self.djname_input = ft.TextField(
            label="DJNAME (最大6文字 半角英数字記号)",
            max_length=6,
            width=200,
            on_change=self.validate_djname
        )

        # ルームパス
        self.room_pass1 = ft.TextField(
            width=100, max_length=4, label="RoomPass1", text_align=ft.TextAlign.CENTER,
            input_filter=ft.NumbersOnlyInputFilter()
        )

        self.room_pass2 = ft.TextField(
            width=100, max_length=4, label="RoomPass2", text_align=ft.TextAlign.CENTER,
            input_filter=ft.NumbersOnlyInputFilter()
        )
        self.room_pass_row = ft.Row([
            self.room_pass1,
            ft.Text("-", size=20),
            self.room_pass2
        ])

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
            options=[ft.dropdown.Option(str(i)) for i in range(2, 4)],
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
                    ft.Container(self.djname_input, col={"sm": 12, "md": 4}),
                    ft.Container(self.room_pass_row, col={"sm": 12, "md": 4}),
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
        self.room_pass1.on_change = self.validate_all_inputs
        self.room_pass2.on_change = self.validate_all_inputs
        self.mode_radio.on_change = self.on_mode_change
        self.user_num_select.on_change = self.validate_all_inputs

    # DJNAMEバリデーション
    def validate_djname(self, e):
        pattern = r'^[a-zA-Z0-9.\-*&!?#$]*$'
        if not re.fullmatch(pattern, self.djname_input.value):
            self.djname_input.error_text = "使用可能文字：a-z A-Z 0-9 .- *&!?#$"
        else:
            self.djname_input.error_text = None
        self.page.update()

    def load_result_table(self):
        if not os.path.exists(RESULT_FILE):
            return

        with open(RESULT_FILE, "r", encoding="utf-8") as f:
            result = json.load(f)

        if not result.get("users") or not result.get("songs"):
            return
        
        headers = ["No.", "曲名"] + [user["user_name"] for user in result["users"]] + ["スキップ"]
        # 初期化
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
                    bgcolor=ft.Colors.RED,
                    color=ft.Colors.WHITE,
                    on_click=lambda e, song_id=song["song_id"]: self.page.run_task(self.on_skip_song, song_id)
                )
                row_cells.append(ft.DataCell(skip_button))

            # DataRow にまとめる
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

    async def show_error_dialog(self, message):
        print(f"show_error_dialog: message={message}")

        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("エラー"),
            content=ft.Text(message),
            actions=[
                ft.TextButton("OK", on_click=lambda e: self.page.close(dialog))
            ]
        )

        self.page.open(dialog)

    async def on_skip_song(self, song_id):
        print(f"スキップ押下: song_id={song_id}")
        await self.battle_handler.skip_song(song_id)

    def load_settings(self):
        self.battle_handler.load_settings()
        
    def on_mode_change(self, e):
        self.battle_handler.on_mode_change()

    def pick_result_file(self, e: ft.FilePickerResultEvent):
        self.battle_handler.pick_result_file(e)

    def validate_all_inputs(self, e=None):
        self.battle_handler.validate_all_inputs()

    async def start_battle(self, e):
        await self.battle_handler.start_battle(e)

    async def stop_battle(self, e):
        await self.battle_handler.stop_battle(e)

    async def async_cleanup(self):
        await self.battle_handler.stop_battle(None)

    def on_close(self, e):
        print("[on_close] start")
        try:
            asyncio.run(self.async_cleanup())
        except Exception as ex:
            print(f"[on_close] エラー: {ex}")
        finally:
            self.page.window_destroy()
            sys.exit(0)