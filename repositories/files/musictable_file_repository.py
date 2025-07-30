
import pickle
from models.musictable_load_result import MusictableLoadResult
from models.settings import Settings
from repositories.files.i_musictable_file_repository import IMusictableFileRepository


class MusictableFileRepository(IMusictableFileRepository):
    def load(self, settings: Settings) -> MusictableLoadResult:
        if not settings.musictable_timestamp_file_exists() or not settings.musictable_file_exists():
            return MusictableLoadResult(data=None, updated=False, timestamp="")

        timestamp_filepath = settings.get_musictable_timestamp_file()
        with open(timestamp_filepath, "r", encoding="utf-8") as f:
            timestamp = f.read()
        
        print(f"timestamp: {timestamp}, settings.resource_timestamp: {settings.resource_timestamp}, is_updated: {timestamp != settings.resource_timestamp}")
        if timestamp == settings.resource_timestamp:
            return MusictableLoadResult(data=None, updated=False, timestamp=timestamp)
        
        musictable_filepath = settings.get_musictable_file()
        with open(musictable_filepath, 'rb') as f:
            data = pickle.load(f)

        return MusictableLoadResult(data=data, updated=True, timestamp=timestamp)
        