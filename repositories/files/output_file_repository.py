import json
from repositories.files.i_output_file_repository import IOutputFileRepository

class OutputFileRepository(IOutputFileRepository):
    OUTPUT_PATH = "result_output.json"

    def save(self, output):
        with open(self.OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=4)
            

    def clear(self):
        """result_output.json を空の結果で初期化"""
        empty_result = {
            "mode": None,
            "users": [],
            "songs": []
        }
        with open(self.OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(empty_result, f, ensure_ascii=False, indent=4)