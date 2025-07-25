from dataclasses import dataclass
from typing import Optional

from config.config import BATTLE_MODE_ARENA, RESULT_SOURCE_DAKEN_COUNTER

@dataclass
class Settings:
    djname: str = ""
    room_pass: str = ""
    mode: str = str(BATTLE_MODE_ARENA)
    user_num: str = "2"
    result_source: str = str(RESULT_SOURCE_DAKEN_COUNTER)
    result_file: Optional[str] = None
