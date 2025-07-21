from controllers.i_app_controller import IAppController
from services.i_settings_service import ISettingsService
from services.i_update_service import IUpdateService
from utils.common import safe_print

class AppController(IAppController):
    def __init__(self, settings_service: ISettingsService, update_service: IUpdateService):
        self.settings_service = settings_service
        self.update_service = update_service

    def load_settings(self):
        return self.settings_service.load_settings()
    
    def check_update(self):
        return self.update_service.check_update()
    
    def perform_update(self, assets):
        return self.update_service.perform_update(assets)