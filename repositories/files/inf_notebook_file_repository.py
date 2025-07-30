import json
from models.settings import Settings
from repositories.files.i_inf_notebook_file_reposirory import IInfNotebookFileRepository

class InfNotebookFileRepository(IInfNotebookFileRepository):
    def load_export(self, settings: Settings):
        export_filepath = settings.get_inf_notebook_export_file()

        if not settings.inf_notebook_export_file_exists():
            return

        with open(export_filepath, "r", encoding="utf-8") as f:
            result = json.load(f)
        return result
