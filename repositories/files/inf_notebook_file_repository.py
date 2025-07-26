import json
from repositories.files.i_inf_notebook_file_reposirory import IInfNotebookFileRepository
from pathlib import Path

class InfNotebookFileRepository(IInfNotebookFileRepository):
    def load_export(self, record_filepath):
        record_path = Path(record_filepath)

        export_filepath = record_path.parent.parent / "export" / "recent.json"

        if not export_filepath.exists():
            return

        with export_filepath.open("r", encoding="utf-8") as f:
            result = json.load(f)
        return result
