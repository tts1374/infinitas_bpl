import requests
import tempfile
import zipfile
import shutil
import os
import sys
import subprocess

from config.config import APP_VERSION

GITHUB_REPO = "tts1374/infinitas_bpl"
ZIP_NAME = "INFINITAS_Online_Battle.zip"

class UpdateResult:
    def __init__(self, need_update=False, error=None):
        self.need_update = need_update
        self.error = error

def check_update():
    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
        r = requests.get(url)
        r.raise_for_status()
        data = r.json()
        latest_version = data["tag_name"]

        if latest_version > APP_VERSION:
            return UpdateResult(need_update=True), data["assets"]
        else:
            return UpdateResult(need_update=False), None
    except Exception as e:
        return UpdateResult(need_update=False, error=str(e)), None

def perform_update(assets):
    try:
        asset = next((a for a in assets if a["name"] == ZIP_NAME), None)
        if not asset:
            return f"{ZIP_NAME} が見つかりません"

        tmp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(tmp_dir, ZIP_NAME)

        r = requests.get(asset["browser_download_url"], stream=True)
        with open(zip_path, "wb") as f:
            shutil.copyfileobj(r.raw, f)

        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(tmp_dir)

        # 上書き先は実行ファイルのあるディレクトリ
        if getattr(sys, 'frozen', False):
            exe_dir = os.path.dirname(sys.executable)
        else:
            exe_dir = os.path.abspath(os.getcwd())  # デバッグ実行用

        # バッチ生成内容（全ファイル上書き）
        pid = os.getpid()
        bat_path = os.path.join(tmp_dir, "update.bat")

        bat_lines = [
            "@echo off",
            "chcp 65001 >nul",
            "timeout /t 2",
            f"taskkill /f /pid {pid}"
        ]

        # ファイルコピー
        for root, dirs, files in os.walk(tmp_dir):
            rel_path = os.path.relpath(root, tmp_dir)
            target_dir = os.path.join(exe_dir, rel_path)
            if not os.path.exists(target_dir):
                bat_lines.append(f'mkdir "{target_dir}"')

            for file in files:
                if file == "update.bat":
                    continue  # 自分自身はコピーしない

                src = os.path.join(root, file)
                dst = os.path.join(target_dir, file)
                bat_lines.append(f'copy /y "{src}" "{dst}"')

        # 一時ディレクトリ削除（ZIP含む）
        bat_lines.append(f'rd /s /q "{tmp_dir}"')

        # EXE再起動
        bat_lines.append(f'start "" "{sys.executable}"')
        bat_lines.append("exit")

        # バッチ出力
        with open(bat_path, "w", encoding="shift_jis") as f:
            f.write("\n".join(bat_lines))

        # バッチ実行 & 終了
        subprocess.Popen(bat_path, shell=True)
        sys.exit(0)

    except Exception as e:
        return str(e)

    return None  # 成功時はエラー無し
