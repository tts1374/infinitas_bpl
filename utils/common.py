from datetime import datetime
import sys
import os

def now_str():
    return datetime.now().isoformat()

def resource_path(relative_path):
    """PyInstaller実行時と通常実行時のパス切り替え"""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.getcwd(), relative_path)