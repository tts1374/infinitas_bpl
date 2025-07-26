APP_VERSION = "v0.2.0"
IS_RELEASE = False
DB_FILE = "result.db"
ZIP_NAME = "INFINITAS_Online_Battle.zip"

# 対戦モード
BATTLE_MODE_ARENA = 1
BATTLE_MODE_BPL = 2
BATTLE_MODE_ARENA_BP = 3
BATTLE_MODE_BPL_BP = 4
# リザルト取得手段
RESULT_SOURCE_DAKEN_COUNTER = 1
RESULT_SOURCE_INF_NOTEBOOK = 2

# Websocket操作
OPERATION_REGISTER = "register"
OPERATION_DELETE = "delete"

# WebsocketURL
if IS_RELEASE:
    WEBSOCKET_URL = "wss://e8dx86e1da.execute-api.ap-northeast-1.amazonaws.com/api"
else:
    WEBSOCKET_URL = "wss://abtz3xytoi.execute-api.ap-northeast-1.amazonaws.com/api"