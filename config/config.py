APP_VERSION = "v0.1.1"
IS_RELEASE = False
DB_FILE = "result.db"

if IS_RELEASE:
    WEBSOCKET_URL = "wss://e8dx86e1da.execute-api.ap-northeast-1.amazonaws.com/api"
else:
    WEBSOCKET_URL = "wss://abtz3xytoi.execute-api.ap-northeast-1.amazonaws.com/api"