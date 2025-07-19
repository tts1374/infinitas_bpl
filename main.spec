# -*- mode: python ; coding: utf-8 -*-

block_cipher = None
flet_view_path = os.path.join(flet_desktop.__path__[0], "flet_view.exe")

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('images/icon.ico', 'images'),
        ('migrations', 'migrations'), 
        (flet_view_path, '.'), 
    ],
    hiddenimports=[
        'flet_desktop',
        'flet_desktop.runtime.windows.flet_view_runner',
    ]
    hookspath=[],
    runtime_hooks=[],
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='INFINITAS_Online_Battle',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,  # GUIアプリの場合 False、コンソール表示したい場合は True
    icon='images/icon.ico' # アイコン指定
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='INFINITAS_Online_Battle'
)
