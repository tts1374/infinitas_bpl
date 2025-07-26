
import json
import os
import pickle
import time
import uuid
from models.music_master import MusicMaster
from models.settings import Settings
from repositories.api.i_musictable_client import IMusictableClient
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.db.i_music_master_repository import IMusicMasterRepository
from usecases.i_master_update_usecase import IMasterUpdateUsecase
from usecases.i_result_send_usecase import IResultSendUsecase
from utils.common import safe_print
import xml.etree.ElementTree as ET

class MasterUpdateUsecase(IMasterUpdateUsecase):
    def __init__(self, musictable_client: IMusictableClient, music_master_repository: IMusicMasterRepository):
        self.musictable_client = musictable_client
        self.music_master_repository = music_master_repository

    def execute(self):
        pickle_result = self.musictable_client.check_and_load_pickle()
        if not pickle_result.updated:
            return
        
        self.music_master_repository.clear()

        music_master_list = []
        for play_style, play_style_value in pickle_result.data["levels"].items():

            for level, songs in play_style_value.items():
                for song in songs:
                    safe_print(f"play_style:{play_style} level:{level} difficulty:{song['difficulty']} name:{song['music']}")
                    music_master = MusicMaster(play_style=play_style, difficulty=song['difficulty'], level=level, song_name=song['music'])
                    music_master_list.append(music_master)

        self.music_master_repository.insert_many(music_master_list)