

from itertools import groupby
import os
import uuid
from db.database import SessionLocal
from models.settings import Settings
from models.user import User
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.db.i_room_repository import IRoomRepository
from repositories.db.i_user_repository import IUserRepository
from repositories.files.i_settings_file_repository import ISettingsFileRepository
from usecases.i_battle_result_handler import IBattleResultHandler
from usecases.i_start_battle_usecase import IStartBattleUsecase

class StartBattleUsecase(IStartBattleUsecase):
    def __init__(
        self, 
        settings_file_repository: ISettingsFileRepository, 
        session, 
        room_repository: IRoomRepository, 
        user_repository: IUserRepository,
        websocket_clinet: IWebsocketClient,
        battle_result_handler: IBattleResultHandler
    ):
        self.settings_file_repository = settings_file_repository
        self.session = session
        self.room_repository = room_repository
        self.user_repository = user_repository
        self.websocket_clinet = websocket_clinet
        self.battle_result_handler = battle_result_handler
        self.app_on_message_callback = None
        self.settings = None
        self.room_id = None

    async def execute(self, settings: Settings, app_on_message_callback) -> str:
        self.settings = settings
        self.app_on_message_callback = app_on_message_callback
        # 設定ファイルの保存
        self.settings_file_repository.save(settings)
        
        try:
            # DBに部屋とユーザを作成
            self.room_id = self.room_repository.insert(
                room_pass= settings.room_pass,
                mode= settings.mode,
                user_num= settings.user_num
            )

            user_token = self.user_repository.create(
                room_id=self.room_id,
                user_token=str(uuid.uuid4()),
                user_name=settings.djname
            )
            
            # Websocketに接続
            self.battle_result_handler.set_param(self.room_id, self.settings, self.app_on_message_callback)
            await self.websocket_clinet.connect(
                settings.room_pass, 
                settings.mode, 
                self.battle_result_handler.handle
            )

            self.session.commit()
            
            return user_token

        except Exception as e:
            self.session.rollback()
            raise e

        finally:
            self.session.close()