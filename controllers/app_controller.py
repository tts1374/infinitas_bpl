from controllers.i_app_controller import IAppController
from services.i_settings_service import ISettingsService

class AppController(IAppController):
    def __init__(self, settings_service: ISettingsService):
        self.settings_service = settings_service

    def load_settings(self):
        return self.settings_service.load_settings()