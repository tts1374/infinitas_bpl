import flet as ft
from controllers.app_controller import AppController
from controllers.main_view_controller import MainViewController
from db.database import SessionLocal
from factories.i_app_factory import IAppFactory
from models.settings import Settings
from repositories.api.github_client import GithubClient
from repositories.api.websocket_client import WebsocketClient
from repositories.db.room_repository import RoomRepository
from repositories.db.user_repository import UserRepository
from repositories.files.output_file_repository import OutputFileRepository
from repositories.files.settings_file_repository import SettingsFileRepository
from usecases.load_settings_usecase import LoadSettingsUsecase
from services.update_service import UpdateService
from usecases.start_battle_usecase import StartBattleUseCase
from views.main_view import MainView


class AppFactory(IAppFactory):
    ################################
    ## SQL Session
    ################################
    @classmethod
    def create_session(cls):
        return SessionLocal()
    
    ################################
    ## Repository
    ################################
    @classmethod
    def create_github_client(cls):
        return GithubClient()
    @classmethod
    def create_websocket_client(cls):
        return WebsocketClient()
    @classmethod
    def create_settings_file_repository(cls):
        return SettingsFileRepository()
    @classmethod
    def create_output_file_repository(cls):
        return OutputFileRepository()
    @classmethod
    def create_room_repository(cls, session):
        return RoomRepository(session)
    @classmethod
    def create_user_repository(cls, session):
        return UserRepository(session)
    
    
    ################################
    ## Service
    ################################
    @classmethod
    def create_update_service(cls):
        github_client = cls.create_github_client()
        return UpdateService(github_client)

    ################################
    ## Usecase
    ################################
    @classmethod
    def create_load_settings_usecase(cls):
        repository = cls.create_settings_file_repository()
        return LoadSettingsUsecase(repository)
    @classmethod
    def create_start_battle_usecase(cls):
        session = cls.create_session()
        settings_file_repository = cls.create_settings_file_repository()
        output_file_repository = cls.create_output_file_repository()
        room_repository = cls.create_room_repository(session)
        user_repository = cls.create_user_repository(session)
        websocket_client = cls.create_websocket_client()
        return StartBattleUseCase(
            settings_file_repository, 
            output_file_repository, 
            session, 
            room_repository, 
            user_repository, 
            websocket_client
        )
    
    ################################
    ## Controller
    ################################
    @classmethod
    def create_app_controller(cls):
        load_settings_usecase = cls.create_load_settings_usecase()
        start_battle_usecase = cls.create_start_battle_usecase()
        update_service = cls.create_update_service()
        return AppController(load_settings_usecase, start_battle_usecase, update_service)
    
    @classmethod
    def create_main_view_controller(cls, app):
        app_controller = cls.create_app_controller()
        return MainViewController(app, app_controller)