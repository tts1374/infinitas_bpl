from dataclasses import dataclass
import os
import re
from typing import Optional

from config.config import BATTLE_MODE_ARENA, BATTLE_MODE_ARENA_BP, BATTLE_MODE_BPL, BATTLE_MODE_BPL_BP, RESULT_SOURCE_DAKEN_COUNTER, RESULT_SOURCE_INF_NOTEBOOK

MUSICTABLE_VERSION = "1.1"

@dataclass
class Settings:
    djname: str = ""
    room_pass: str = ""
    mode: int = BATTLE_MODE_ARENA
    user_num: int = 2
    result_source: int = RESULT_SOURCE_DAKEN_COUNTER
    result_dir: Optional[str] = None
    resource_timestamp: str = ""
    
    # リザルトファイル
    def get_result_file(self) -> str:
        if self.result_source == RESULT_SOURCE_DAKEN_COUNTER:
            return os.path.join(self.result_dir, "today_update.xml")
        elif self.result_source == RESULT_SOURCE_INF_NOTEBOOK:
            return os.path.join(self.result_dir, "records", "recent.json")
        else:
            raise None
    
    # リザルト手帳>export/recent.json
    def get_inf_notebook_export_file(self) -> str:
        if self.result_source == RESULT_SOURCE_INF_NOTEBOOK:
            return os.path.join(self.result_dir, "export", "recent.json")
        else:
            raise None
    
    def get_musictable_timestamp_file(self) -> str:
        if self.result_source == RESULT_SOURCE_DAKEN_COUNTER or self.result_source == RESULT_SOURCE_INF_NOTEBOOK:
            return os.path.join(self.result_dir, "resources", f"musictable{MUSICTABLE_VERSION}.res.timestamp")
        else:
            raise None
    
    def get_musictable_file(self) -> str:
        if self.result_source == RESULT_SOURCE_DAKEN_COUNTER or self.result_source == RESULT_SOURCE_INF_NOTEBOOK:
            return os.path.join(self.result_dir, "resources", f"musictable{MUSICTABLE_VERSION}.res")
        else:
            raise None
        
    def result_file_exists(self) -> bool:
        file_path = self.get_result_file()
        return os.path.isfile(file_path)
    
    def inf_notebook_export_file_exists(self) -> bool:
        file_path = self.get_inf_notebook_export_file()
        return os.path.isfile(file_path)
    
    def musictable_timestamp_file_exists(self) -> bool:
        file_path = self.get_musictable_timestamp_file()
        return os.path.isfile(file_path)
    
    def musictable_file_exists(self) -> bool:
        file_path = self.get_musictable_file()
        return os.path.isfile(file_path)
    
    def is_valid(self) -> bool:
        djname_ok = re.fullmatch(r'^[a-zA-Z0-9.\-\*&!?#$]{1,6}$', self.djname) is not None
        room_pass_ok = re.fullmatch(r'^[a-zA-Z0-9_-]{4,36}$', self.room_pass) is not None
        mode_ok = self.mode in [BATTLE_MODE_ARENA, BATTLE_MODE_BPL, BATTLE_MODE_ARENA_BP, BATTLE_MODE_BPL_BP]
        user_num_ok = (self.mode in [BATTLE_MODE_BPL, BATTLE_MODE_BPL_BP]) or (self.user_num != 0)
        result_source_ok = self.result_source in [RESULT_SOURCE_DAKEN_COUNTER, RESULT_SOURCE_INF_NOTEBOOK]
        file_ok = self.result_dir is not None and self.result_file_exists()

        return djname_ok and room_pass_ok and mode_ok and user_num_ok and result_source_ok and file_ok