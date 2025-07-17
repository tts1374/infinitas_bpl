import sqlite3
import os
import glob

from utils.common import resource_path

MIGRATIONS_DIR = "migrations"
DB_FILE = "result.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    # db_version テーブルが無ければ作成
    c.execute("""
        CREATE TABLE IF NOT EXISTS db_version (
            version INTEGER PRIMARY KEY
        )
    """)

    # 現在のバージョンを取得
    c.execute("SELECT MAX(version) FROM db_version")
    row = c.fetchone()
    current_version = row[0] if row[0] is not None else 0

    # migrationsフォルダからマイグレーション実行
    migration_dir = resource_path(MIGRATIONS_DIR)
    migration_files = sorted(glob.glob(os.path.join(migration_dir, "*.sql")))

    for file in migration_files:
        filename = os.path.basename(file)
        version = int(filename.split("_")[0][-3:])  # 001 002 の数字を抽出

        if version > current_version:
            print(f"Applying migration {file}...")
            with open(file, "r", encoding="utf-8") as f:
                sql = f.read()
            c.executescript(sql)
            current_version = version

    conn.commit()
    conn.close()