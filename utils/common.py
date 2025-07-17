from datetime import datetime
import sys
import os
import io

def now_str():
    return datetime.now().isoformat()

def resource_path(relative_path):
    """PyInstaller実行時と通常実行時のパス切り替え"""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.getcwd(), relative_path)

def safe_print(*args, **kwargs):
    try:
        # PyInstallerでGUI（--noconsole）実行の場合はprintをスキップ
        if getattr(sys, 'frozen', False):
            return
        # stdoutが実行可能か確認
        if sys.stdout is None:
            return
        if not sys.stdout.isatty():
            return
        print(*args, **kwargs)

    except (io.UnsupportedOperation, AttributeError):
        pass