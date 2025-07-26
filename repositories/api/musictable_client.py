
import pickle
import requests
import os
import json
from models.musictable_load_result import MusictableLoadResult
from repositories.api.i_musictable_client import IMusictableClient

# 保存用メタ情報ファイル（ETagなどを記録）
META_FILE = "file_meta.json"
GITHUB_RESOURCE_URL = "https://raw.githubusercontent.com/kaktuswald/inf-notebook/master/resources/musictable1.1.res"
LOCAL_RESOURCE_PATH = "./musictable1.1.res"

class MusictableClient(IMusictableClient):
    def load_meta(self):
        if os.path.exists(META_FILE):
            with open(META_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def save_meta(self, meta):
        with open(META_FILE, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

    def check_and_load_pickle(self) -> MusictableLoadResult:
        meta = self.load_meta()
        etag = meta.get(GITHUB_RESOURCE_URL)

        headers = {}
        if etag:
            headers["If-None-Match"] = etag

        response = requests.get(GITHUB_RESOURCE_URL, headers=headers)

        if response.status_code == 304:
            print("変更なし：データ取得せず。")
            return MusictableLoadResult(data=None, updated=False)

        if response.status_code == 200:
            print("変更あり：pickleデータを読み込みます。")
            try:
                data = pickle.loads(response.content)
            except Exception as e:
                print(f"pickle読み込みエラー: {e}")
                return MusictableLoadResult(data=None, updated=True)  # 更新はされたがエラー

            new_etag = response.headers.get("ETag")
            if new_etag:
                meta[GITHUB_RESOURCE_URL] = new_etag
                self.save_meta(meta)

            return MusictableLoadResult(data=data, updated=True)

        print(f"エラー: {response.status_code}")
        return MusictableLoadResult(data=None, updated=False)