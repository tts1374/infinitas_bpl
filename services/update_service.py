import os
import sys
import subprocess

from models.program_update_result import ProgramUpdateResult
from repositories.api.github_repository import GithubRepository
from repositories.files.storage_repository import StorageRepository
from config.config import APP_VERSION

class UpdateService:
    def __init__(self):
        self.githubRepository = GithubRepository()
        self.storageRepository = StorageRepository()

    def check_update(self):
        try:
            data = self.githubRepository.get_latest_release()
            latest_version = data["tag_name"]

            if latest_version > APP_VERSION:
                return ProgramUpdateResult(need_update=True), data["assets"]
            else:
                return ProgramUpdateResult(need_update=False), None
        except Exception as e:
            return ProgramUpdateResult(need_update=False, error=str(e)), None

    def perform_update(self, assets):
        try:
            asset = next((a for a in assets if a["name"] == self.githubRepository.zip_name), None)
            if not asset:
                return f"{self.githubRepository.zip_name} が見つかりません"

            zip_path = self.githubRepository.download_zip(asset["browser_download_url"])
            tmp_dir = self.storageRepository.extract_zip(zip_path)

            if getattr(sys, 'frozen', False):
                exe_dir = os.path.dirname(sys.executable)
                exe_path = sys.executable
            else:
                exe_dir = os.path.abspath(os.getcwd())
                exe_path = f"{sys.executable} {os.path.abspath(sys.argv[0])}"

            bat_dir = os.environ.get("TEMP", tmp_dir)
            bat_path = os.path.join(bat_dir, "update_infinitas_bpl.bat")

            pid = os.getpid()
            bat_lines = []
            bat_lines.append("@echo off")
            bat_lines.append("chcp 65001 >nul")
            bat_lines.append("echo --- Update Start ---")
            bat_lines.append("timeout /t 2 >nul")
            bat_lines.append(f"taskkill /PID {pid} /F >nul 2>nul")
            bat_lines.append("ping 127.0.0.1 -n 3 >nul")

            # コピー
            for root, dirs, files in os.walk(tmp_dir):
                rel_path = os.path.relpath(root, tmp_dir)
                target_dir = os.path.join(exe_dir, rel_path)
                bat_lines.append(f'if not exist "{target_dir}" mkdir "{target_dir}"')
                for file in files:
                    src = os.path.join(root, file)
                    dst = os.path.join(target_dir, file)
                    bat_lines.append(f'copy /y "{src}" "{dst}" >nul')

            # 一時ディレクトリ削除
            bat_lines.append(f'rd /s /q "{tmp_dir}"')
            bat_lines.append("echo --- Update Complete ---")

            # 再起動
            bat_lines.append(f'start "" {exe_path}')
            bat_lines.append("exit")

            with open(bat_path, "w", encoding="utf-8") as f:
                f.write("\n".join(bat_lines))

            subprocess.Popen(["cmd", "/c", bat_path], creationflags=subprocess.CREATE_NEW_CONSOLE)
            sys.exit(0)

        except Exception as e:
            return str(e)

        return None