import flet as ft
from controllers.app_controller import AppController
from controllers.main_view_controller import MainViewController
from factories.i_app_factory import IAppFactory
from repositories.files.settings_file_repository import SettingsFileRepository
from services.settings_service import SettingsService
from views.main_view import MainView


class AppFactory(IAppFactory):
    ################################
    ## Service
    ################################
    @classmethod
    def create_settings_service(cls):
        repository = SettingsFileRepository()
        return SettingsService(repository)
        
    ################################
    ## Controller
    ################################
    @classmethod
    def create_app_controller(cls):
        settings_service = cls.create_settings_service()
        return AppController(settings_service)
    
    @classmethod
    def create_main_view_controller(cls, app):
        app_controller = cls.create_app_controller()
        return MainViewController(app, app_controller)