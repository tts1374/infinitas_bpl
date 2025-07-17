import os
import re
import subprocess
import shutil
import sys

CONFIG_FILE = "./config/config.py"
output_dir = "dist/INFINITAS_Online_Battle"
exe_name = "INFINITAS_Online_Battle"

def ensure_pyinstaller():
    try:
        import PyInstaller
    except ImportError:
        print("❗ PyInstaller が見つかりません。自動でインストールします。")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)

def set_release_mode(is_release=True):
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    # IS_RELEASEの部分を書き換え
    new_content = re.sub(r"IS_RELEASE\s*=\s*(True|False)", f"IS_RELEASE = {str(is_release)}", content)

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"✅ config.py を {'リリース' if is_release else '開発'}モードに設定しました。")

def clean():
    """過去のビルドファイル削除"""
    for folder in ["build", "dist", "__pycache__"]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
    if os.path.exists("INFINITAS_Online_Battle.spec"):
        os.remove("INFINITAS_Online_Battle.spec")

def build():
    ensure_pyinstaller()
    """PyInstallerでビルド実行"""
    cmd = [
        sys.executable,  # python.exe のパス
        "-m", "PyInstaller",
        "main.spec",
    ]
    print("ビルドを開始します...")
    subprocess.run(cmd, check=True)
    # 出力フォルダにbpl_battle.htmlをコピー
    shutil.copy("bpl_battle.html", os.path.join(output_dir, "bpl_battle.html"))
    # imagesフォルダごとコピー
    shutil.copytree("images", os.path.join(output_dir, "images"), dirs_exist_ok=True)
    print("ビルドが完了しました。dist/ 以下にexeが生成されています。")

if __name__ == "__main__":
    try:
        # ① リリースモードに設定
        set_release_mode(True)

        # ② ビルド実行
        clean()
        build()

    finally:
        # ③ 開発モードに戻す
        set_release_mode(False)