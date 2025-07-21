
from models.settings import Settings
from repositories.files.i_settings_file_repository import ISettingsFileRepository
from services.i_settings_service import ISettingsService

class SettingsService(ISettingsService):
    def __init__(self, repository: ISettingsFileRepository):
        self.repository = repository

    def load_settings(self) -> Settings:
        return self.repository.load()