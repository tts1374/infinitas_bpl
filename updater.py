import sys
import os
import time
import zipfile
import shutil
import subprocess

def wait_for_process(exe_name):
    while True:
        out = os.popen(f'tasklist /FI "IMAGENAME eq {exe_name}"').read()
        if exe_name not in out:
            break
        time.sleep(1)

def main():
    if len(sys.argv) != 3:
        print("Usage: updater.exe [zip_path] [target_exe_name]")
        sys.exit(1)

    zip_path = sys.argv[1]
    target_exe = sys.argv[2]

    wait_for_process(target_exe)

    # ZIP解凍
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall("update_tmp")

    # コピー
    for root, dirs, files in os.walk("update_tmp"):
        for file in files:
            src = os.path.join(root, file)
            dst = os.path.join(os.getcwd(), os.path.relpath(src, "update_tmp"))
            shutil.copy2(src, dst)

    shutil.rmtree("update_tmp")
    os.remove(zip_path)

    # 再起動
    subprocess.Popen([target_exe])

if __name__ == "__main__":
    main()