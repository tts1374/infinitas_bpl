import requests
import tempfile
import zipfile
import shutil
import os

GITHUB_REPO = "tts1374/infinitas_bpl"
ZIP_NAME = "INFINITAS_Online_Battle.zip"

class GithubRepository:
    def __init__(self):
        self.repo = GITHUB_REPO
        self.zip_name = ZIP_NAME

    def get_latest_release(self):
        url = f"https://api.github.com/repos/{self.repo}/releases/latest"
        r = requests.get(url)
        r.raise_for_status()
        return r.json()

    def download_zip(self, asset_url) -> str:
        tmp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(tmp_dir, self.zip_name)
        r = requests.get(asset_url, stream=True)
        with open(zip_path, "wb") as f:
            shutil.copyfileobj(r.raw, f)
        return zip_path