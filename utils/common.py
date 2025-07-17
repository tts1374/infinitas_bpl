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
        if sys.stdout and not isinstance(sys.stdout, io.TextIOWrapper):
            # GUIモード（stdoutは無効）
            return
        print(*args, **kwargs)
    except (io.UnsupportedOperation, AttributeError):
        # 標準出力なし（PyInstaller GUI実行など）
        pass