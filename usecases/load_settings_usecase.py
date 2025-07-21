
from models.settings import Settings
from repositories.files.i_settings_file_repository import ISettingsFileRepository
from usecases.i_load_settings_usecase import ILoadSettingsUsecase

class LoadSettingsUsecase(ILoadSettingsUsecase):
    def __init__(self, repository: ISettingsFileRepository):
        self.repository = repository

    def execute(self) -> Settings:
        return self.repository.load()