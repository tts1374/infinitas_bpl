import zipfile
import os

class StorageRepository:
    def extract_zip(self, zip_path: str) -> str:
        extract_dir = os.path.dirname(zip_path)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        os.remove(zip_path)  # 解凍後にZIP削除
        return extract_dir
