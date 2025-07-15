IS_RELEASE = False

if IS_RELEASE:
    WEBSOCKET_URL = "wss://e8dx86e1da.execute-api.ap-northeast-1.amazonaws.com/api"
else:
    WEBSOCKET_URL = "wss://abtz3xytoi.execute-api.ap-northeast-1.amazonaws.com/api"