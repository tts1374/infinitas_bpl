import json
import os
from models.settings import Settings
from repositories.files.i_settings_file_repository import ISettingsFileRepository

class SettingsFileRepository(ISettingsFileRepository):
    SETTINGS_PATH = "settings.json"

    def save(self, settings: Settings):
        with open(self.SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(settings.__dict__, f, ensure_ascii=False, indent=4)
            
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