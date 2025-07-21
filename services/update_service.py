import os
import sys
import subprocess

from models.program_update_result import ProgramUpdateResult
from repositories.api.github_client import GithubClient
from repositories.api.i_github_client import IGithubClient
from config.config import APP_VERSION, ZIP_NAME
from services.i_update_service import IUpdateService
from utils.common import safe_print

class UpdateService(IUpdateService):
    def __init__(self, github_client: IGithubClient):
        self.github_client = github_client
        self.zip_name = ZIP_NAME

    def check_update(self):
        try:
            data = self.github_client.get_latest_release()
            latest_version = data["tag_name"]

            if latest_version > APP_VERSION:
                return ProgramUpdateResult(need_update=True), data["assets"]
            else:
                return ProgramUpdateResult(need_update=False), None
        except Exception as e:
            return ProgramUpdateResult(need_update=False, error=str(e)), None

    def perform_update(self, assets):
        try:
            asset = next((a for a in assets if a["name"] == self.zip_name), None)
            if not asset:
                return f"{self.zip_name} が見つかりません"

            # ZIPダウンロード
            zip_path = self.github_client.download_zip(asset["browser_download_url"])

            if getattr(sys, 'frozen', False):
                exe_dir = os.path.dirname(sys.executable)
                exe_name = os.path.basename(sys.executable)
            else:
                exe_dir = os.path.abspath(os.getcwd())
                exe_name = os.path.basename(sys.argv[0])
            
            # updater.exe のパス（exeと同じディレクトリに配置する想定）
            updater_path = os.path.join(exe_dir, "updater.exe")

            # 引数を渡して実行
            cmd = [
                updater_path,
                zip_path,
                exe_name
            ]

            subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)

            # 自分自身は終了
            sys.exit(0)

        except Exception as e:
            return str(e)

        return None