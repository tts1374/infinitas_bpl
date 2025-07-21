from dataclasses import dataclass
from typing import Optional

@dataclass
class Settings:
    djname: str = ""
    room_pass: str = ""
    mode: str = "1"
    user_num: str = "2"
    result_file: Optional[str] = None
