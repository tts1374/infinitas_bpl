
from models.settings import Settings
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.files.i_settings_file_repository import ISettingsFileRepository
from usecases.i_load_settings_usecase import ILoadSettingsUsecase
from usecases.i_stop_battle_usecase import IStopBattleUsecase
from utils.common import safe_print

class StopBattleUsecase(IStopBattleUsecase):
    def __init__(self, websocket_clinet: IWebsocketClient):
        self.websocket_clinet = websocket_clinet

    async def execute(self):
        if self.websocket_clinet:
            await self.websocket_clinet.disconnect()
            safe_print("Websocket disconnect")