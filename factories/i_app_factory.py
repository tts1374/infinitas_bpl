from abc import ABC, abstractmethod
import flet as ft

from controllers.i_app_controller import IAppController
from controllers.i_main_view_controller import IMainViewController
from models.settings import Settings
from repositories.api.i_github_client import IGithubClient
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.db.i_room_repository import IRoomRepository
from repositories.db.i_user_repository import IUserRepository
from repositories.files.i_output_file_repository import IOutputFileRepository
from repositories.files.i_settings_file_repository import ISettingsFileRepository
from usecases.i_load_settings_usecase import ILoadSettingsUsecase
from usecases.i_start_battle_usecase import IStartBattleUseCase

class IAppFactory(ABC):
    ################################
    ## SQL Session
    ################################
    @abstractmethod
    def create_session(self):
        pass

    ################################
    ## Repository
    ################################
    @abstractmethod
    def create_github_client(cls) -> IGithubClient:
        pass
    @abstractmethod
    def create_websocket_client(cls) -> IWebsocketClient:
        pass
    @abstractmethod
    def create_settings_file_repository(cls) -> ISettingsFileRepository:
        pass
    @abstractmethod
    def create_output_file_repository(cls) -> IOutputFileRepository:
        pass
    @abstractmethod
    def create_room_repository(cls, session) -> IRoomRepository:
        pass
    @abstractmethod
    def create_user_repository(cls, session) -> IUserRepository:
        pass
    
    
    ################################
    ## Service
    ################################
    @abstractmethod
    def create_load_settings_usecase(self) -> ILoadSettingsUsecase:
        pass
    @abstractmethod
    def create_load_settings_usecase(self) -> ILoadSettingsUsecase:
        pass

    ################################
    ## Usecase
    ################################
    @abstractmethod
    def create_load_settings_usecase(cls) -> ILoadSettingsUsecase:
        pass
    
    @abstractmethod
    def create_start_battle_usecase(cls, settings: Settings) -> IStartBattleUseCase:
        pass
    
    ################################
    ## Controller
    ################################
    @abstractmethod
    def create_app_controller(self) -> IAppController:
        pass

    @abstractmethod
    def create_main_view_controller(self, app) -> IMainViewController:
        pass