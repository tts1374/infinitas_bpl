
from models.settings import Settings
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.files.i_settings_file_repository import ISettingsFileRepository
from usecases.i_load_settings_usecase import ILoadSettingsUsecase
from usecases.i_result_send_usecase import IResultSendUsecase

class ResultSendUsecase(IResultSendUsecase):
    def __init__(self, websocket_client: IWebsocketClient):
        self.websocket_client = websocket_client

    def execute(self, result_data):
        return self.websocket_client.send(result_data)