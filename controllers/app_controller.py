from controllers.i_app_controller import IAppController
from usecases.i_load_settings_usecase import ILoadSettingsUsecase
from services.i_update_service import IUpdateService
from usecases.i_start_battle_usecase import IStartBattleUseCase

class AppController(IAppController):
    def __init__(self, load_settings_usecase: ILoadSettingsUsecase, start_battle_usecase: IStartBattleUseCase, update_service: IUpdateService):
        self.load_settings_usecase = load_settings_usecase
        self.start_battle_usecase = start_battle_usecase
        self.update_service = update_service

    def load_settings(self):
        return self.load_settings_usecase.execute()
    
    def check_update(self):
        return self.update_service.check_update()
    
    def perform_update(self, assets):
        return self.update_service.perform_update(assets)
    
    async def start_battle(self, settings, on_message_callback):
        await self.start_battle_usecase.execute(settings, on_message_callback)
