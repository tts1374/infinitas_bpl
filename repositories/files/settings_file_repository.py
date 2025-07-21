import json
import os
from models.settings import Settings
from repositories.files.i_settings_file_repository import ISettingsFileRepository

class SettingsFileRepository(ISettingsFileRepository):
    SETTINGS_PATH = "settings.json"

    def load(self) -> Settings:
        if not os.path.exists(self.SETTINGS_PATH):
            return Settings()

        with open(self.SETTINGS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        return Settings(
            djname=data.get("djname", ""),
            room_pass=data.get("room_pass", ""),
            mode=str(data.get("mode", "1")),
            user_num=str(data.get("user_num", "2")),
            result_file=data.get("result_file")
        )