from controllers.i_app_controller import IAppController
from models.user import User
from usecases.i_load_settings_usecase import ILoadSettingsUsecase
from services.i_update_service import IUpdateService
from usecases.i_result_send_usecase import IResultSendUsecase
from usecases.i_start_battle_usecase import IStartBattleUsecase
from usecases.i_stop_battle_usecase import IStopBattleUsecase

class AppController(IAppController):
    def __init__(
        self, 
        load_settings_usecase: ILoadSettingsUsecase, 
        start_battle_usecase: IStartBattleUsecase,
        stop_battle_usecase: IStopBattleUsecase, 
        result_send_usecase: IResultSendUsecase,
        update_service: IUpdateService
    ):
        self.load_settings_usecase = load_settings_usecase
        self.start_battle_usecase = start_battle_usecase
        self.stop_battle_usecase = stop_battle_usecase
        self.result_send_usecase = result_send_usecase
        self.update_service = update_service

    def load_settings(self):
        return self.load_settings_usecase.execute()
    
    def check_update(self):
        return self.update_service.check_update()
    
    def perform_update(self, assets):
        return self.update_service.perform_update(assets)
    
    async def start_battle(self, settings, on_message_callback) -> str:
        return await self.start_battle_usecase.execute(settings, on_message_callback)
    
    async def stop_battle(self):
        await self.stop_battle_usecase.execute()
        
    async def result_send(self, result_data):
        await self.result_send_usecase.execute(result_data)
