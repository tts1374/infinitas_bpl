import flet as ft
from config.config import BATTLE_MODE_ARENA

DIFFICULTY_COLOR_MAP = {
    "BEGINNER": "#d3e173",
    "NORMAL": "#21efef",
    "HYPER": "#ffc800",
    "ANOTHER": "#fba8c1",
    "LEGGENDARIA": "#ce8ef9",
}

MAIN_COLOR = "#EEEEEE"
SONG_ICON_COLOR = ft.Colors.WHITE
TITLE_NAME_COLOR = ft.Colors.WHITE
USER_COLORS = ["#639bff", "#ff4841", "#bdcf16", "#0fdd3c"]

class ArenaResultTable:
    def __init__(self, page: ft.Page, result_data: dict, on_skip_callback, on_delete_callback, setting_visible:bool, is_enable_operation:bool):
        self.page = page
        self.result_data = result_data
        self.on_skip_callback = on_skip_callback
        self.on_delete_callback = on_delete_callback

        self.users = result_data.get("users", [])
        self.user_ids = [u["user_id"] for u in self.users]
        self.user_names = [u["user_name"] for u in self.users]
        self.mode = result_data.get("mode", BATTLE_MODE_ARENA)
        self.setting_visible = setting_visible
        self.is_enable_operation = is_enable_operation

    def _user_name_box(self, name: str, bgcolor: str) -> ft.Container:
        return ft.Container(
            content=ft.Text(name, size=18, color=TITLE_NAME_COLOR, weight=ft.FontWeight.BOLD),
            bgcolor=bgcolor,
            alignment=ft.alignment.center,
            expand=True,
            padding=5
        )

    def _build_header(self) -> ft.Row:
        return ft.Row(
            controls=[
                ft.Container(width=360),  # 曲情報領域
                *[
                    self._user_name_box(self.user_names[i], USER_COLORS[i])
                    for i in range(len(self.user_names))
                ]
            ],
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            opacity=0.95
        )

    def _user_score(self, result: dict | None) -> ft.Column:
        if result:
            label = f"SCORE: {result['score']}" if self.mode == BATTLE_MODE_ARENA else f"MISS COUNT: {result['miss_count']}"
            value = result.get("pt", 0)
        else:
            label = "SCORE: -" if self.mode == BATTLE_MODE_ARENA else "MISS COUNT: -"
            value = "-"

        return ft.Column([
            ft.Text(
                str(value),
                size=28,
                color=MAIN_COLOR,
                weight=ft.FontWeight.BOLD,
            ),
            ft.Text(label, size=10, color=MAIN_COLOR),
        ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER, expand=True)

    def _song_info(self, song: dict) -> ft.Column:
        stage_no = song.get("stage_no", 1)
        stage_suffix = {1: "ST", 2: "ND", 3: "RD"}.get(stage_no if stage_no < 20 else stage_no % 10, "TH")
        stage_label = f"{stage_no}{stage_suffix} STAGE"

        title = song.get("song_name", "")
        play_style = song.get("play_style", "")
        difficulty = song.get("difficulty", "")
        level = song.get("level", "")
        difficulty_color = DIFFICULTY_COLOR_MAP.get(difficulty.upper(), MAIN_COLOR)

        return ft.Column([
            ft.Text(stage_label, size=10, color=MAIN_COLOR),
            ft.Text(title, size=16, color=MAIN_COLOR, no_wrap=True, overflow=ft.TextOverflow.ELLIPSIS),
            ft.Row([
                ft.Container(
                    ft.Text(play_style, color=ft.Colors.BLACK),
                    bgcolor=SONG_ICON_COLOR,
                    padding=ft.padding.symmetric(horizontal=10),
                    border_radius=10
                ),
                ft.Text(f"{difficulty} {level}", color=difficulty_color)
            ], alignment=ft.MainAxisAlignment.CENTER)
        ], alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER)

    def _get_result_by_user(self, results: list[dict]) -> list[dict | None]:
        return [
            next((r for r in results if r["user_id"] == uid), None)
            for uid in self.user_ids
        ]
        
    def _make_button(self, song_id, is_deletable):
        return ft.ElevatedButton(
            text="削除" if is_deletable else "スキップ",
            icon=ft.Icons.DELETE if is_deletable else ft.Icons.SKIP_NEXT,
            on_click=lambda e: self.page.run_task(
                self.on_delete_callback if is_deletable else self.on_skip_callback,
                song_id
            ),
            style=ft.ButtonStyle(
                bgcolor="transparent",
                overlay_color="transparent",
                shadow_color="transparent",
                color=ft.Colors.RED if is_deletable else ft.Colors.BLUE
            )
        )
    def _build_song_rows(self) -> list[ft.Container]:
        rows = []

        for song in sorted(self.result_data.get("songs", []), key=lambda s: s.get("stage_no", 0), reverse=True):
            results = song.get("results", [])
            user_results = self._get_result_by_user(results)

            button_overlay = ft.Ref[ft.Container]()

            def create_hover_handlers(overlay_ref):
                def on_enter(e):
                    print(f"on_enter: {self.is_enable_operation}")
                    if self.setting_visible or not self.is_enable_operation:
                        return
                    overlay_ref.current.opacity = 0.9
                    overlay_ref.current.bgcolor = ft.Colors.WHITE
                    overlay_ref.current.update()

                def on_exit(e):
                    if self.setting_visible or not self.is_enable_operation:
                        return
                    overlay_ref.current.opacity = 0.0
                    overlay_ref.current.bgcolor = "transparent"
                    overlay_ref.current.update()

                return on_enter, on_exit

            on_enter, on_exit = create_hover_handlers(button_overlay)

            has_user0 = user_results[0] is not None if len(user_results) > 0 else False
            button = self._make_button(song["song_id"], has_user0)

            row = ft.GestureDetector(
                on_enter=on_enter,
                on_exit=on_exit,
                content=ft.Stack(
                    controls=[
                        # 背景＋スコア表示
                        ft.Container(
                            content=ft.Row(
                                controls=[
                                    ft.Container(content=self._song_info(song), width=360),
                                    *[self._user_score(r) for r in user_results]
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN
                            ),
                            bgcolor="#4B4B4B",
                            padding=10,
                            border_radius=5,
                            width=1200,
                            height=100
                        ),
                        # ホバー時の削除/スキップボタン
                        ft.Container(
                            ref=button_overlay,
                            content=ft.Row([
                                ft.Container(content=button, width=1200, alignment=ft.alignment.center)
                            ], alignment=ft.MainAxisAlignment.CENTER),
                            padding=10,
                            width=1200,
                            height=100,
                            opacity=0.0,
                            bgcolor="transparent",
                            animate_opacity=300
                        )
                    ]
                )
            )

            rows.append(row)
        return ft.Container(
            height=320 if self.setting_visible else 620,
            content=ft.Column(
                controls=rows,
                scroll="auto",
                spacing=10
            )
        )

    def _get_total_pt(self, user_index: int) -> int:
        if user_index >= len(self.user_ids):
            return 0
        user_id = self.user_ids[user_index]
        total = 0
        for song in self.result_data.get("songs", []):
            matched = next((r for r in song["results"] if r["user_id"] == user_id), None)
            total += matched["pt"] if matched else 0
        return total

    def _build_total_row(self) -> ft.Row:
        return ft.Container(
            content=ft.Row(
                controls=[
                    ft.Container(width=360),
                    *[
                        ft.Column([
                            ft.Text("TOTAL", size=10, color=MAIN_COLOR),
                            ft.Text(str(self._get_total_pt(i)), size=24, color=MAIN_COLOR)
                        ], alignment=ft.MainAxisAlignment.CENTER,
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        expand=True)
                        for i in range(len(self.user_ids))
                    ]
                ]
            ),
            bgcolor="#4B4B4B",
            padding=10,
            border_radius=5
        )

    def build(self) -> ft.Column:
        return ft.Column(
            controls=[
                self._build_header(),
                self._build_song_rows(),
                self._build_total_row()
            ],
            spacing=10,
            width=1200,
            horizontal_alignment=ft.CrossAxisAlignment.CENTER
        )
