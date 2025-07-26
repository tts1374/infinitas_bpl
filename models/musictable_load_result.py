from dataclasses import dataclass
from typing import Any

@dataclass
class MusictableLoadResult:
    data: Any
    updated: bool