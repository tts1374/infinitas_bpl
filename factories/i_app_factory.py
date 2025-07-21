from abc import ABC, abstractmethod
import flet as ft

from controllers.i_app_controller import IAppController
from controllers.i_main_view_controller import IMainViewController
from services.i_settings_service import ISettingsService

class IAppFactory(ABC):
    ################################
    ## Service
    ################################
    @abstractmethod
    def create_settings_service(self) -> ISettingsService:
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