from typing import Tuple
from application.i_main_app_service import IMainAppSerivce
from models.settings import Settings
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.files.i_output_file_repository import IOutputFileRepository
from repositories.files.i_settings_file_repository import ISettingsFileRepository
from services.i_update_service import IUpdateService
from usecases.i_delete_song_usecase import IDeleteSongUsecase
from usecases.i_master_update_usecase import IMasterUpdateUsecase
from usecases.i_result_send_usecase import IResultSendUsecase
from usecases.i_screenshot_usecase import IScreenshotUsecase
from usecases.i_skip_song_usecase import ISkipSongUsecase
from usecases.i_start_battle_usecase import IStartBattleUsecase
from utils.common import safe_print

class MainAppService(IMainAppSerivce):
    def __init__(
        self,  
        start_battle_usecase: IStartBattleUsecase,
        result_send_usecase: IResultSendUsecase,
        skip_song_usecase: ISkipSongUsecase,
        delete_song_usecase: IDeleteSongUsecase,
        master_update_usecase: IMasterUpdateUsecase,
        screenshot_usecase: IScreenshotUsecase,
        update_service: IUpdateService,
        settings_file_repository: ISettingsFileRepository,
        output_file_repository: IOutputFileRepository,
        websocket_client: IWebsocketClient
    ):
        self.settings_file_repository = settings_file_repository
        self.output_file_repository = output_file_repository
        self.start_battle_usecase = start_battle_usecase
        self.websocket_clinet = websocket_client
        self.result_send_usecase = result_send_usecase
        self.skip_song_usecase = skip_song_usecase
        self.delete_song_usecase = delete_song_usecase
        self.master_update_usecase = master_update_usecase
        self.screenshot_usecase = screenshot_usecase
        self.update_service = update_service

    def load_settings(self):
        return self.settings_file_repository.load()
    
    def check_update(self):
        return self.update_service.check_update()
    
    def perform_update(self, assets, callback):
        return self.update_service.perform_update(assets, callback)
    
    async def start_battle(self, settings, on_message_callback) -> Tuple[int, str]:
        return await self.start_battle_usecase.execute(settings, on_message_callback)
    
    async def stop_battle(self):
        if self.websocket_clinet:
            await self.websocket_clinet.disconnect()
            safe_print("Websocket disconnect")
                    
    async def result_send(self, user_token, settings, content):
        await self.result_send_usecase.execute(user_token, settings, content)
        
    async def skip_song(self, room_id:int, user_token: str, settings:Settings, song_id: int):
        await self.skip_song_usecase.execute(room_id, user_token, settings, song_id)
        
    async def delete_song(self, room_id:int, user_token: str, settings:Settings, song_id: int):
        await self.delete_song_usecase.execute(room_id, user_token, settings, song_id)
    
    def initialize_output_file(self):
        self.output_file_repository.clear()
    def load_output_file(self):
        return self.output_file_repository.load()
    
    def update_master_data(self, settings: Settings) -> str:
        return self.master_update_usecase.execute(settings)
    
    def take_screenshot(self, path: str, window_title: str):
        self.screenshot_usecase.execute(path, window_title)
