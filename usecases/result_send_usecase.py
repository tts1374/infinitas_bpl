
import json
import time
import uuid
from config.config import RESULT_SOURCE_DAKEN_COUNTER, RESULT_SOURCE_INF_NOTEBOOK
from models.settings import Settings
from repositories.api.i_websocket_client import IWebsocketClient
from repositories.db.i_music_master_repository import IMusicMasterRepository
from repositories.files.i_inf_notebook_file_reposirory import IInfNotebookFileRepository
from usecases.i_result_send_usecase import IResultSendUsecase
from utils.common import safe_print
import xml.etree.ElementTree as ET

class ResultSendUsecase(IResultSendUsecase):
	def __init__(
		self, 
		websocket_client: IWebsocketClient, 
		inf_notebook_file_repository: IInfNotebookFileRepository, 
		music_master_repository: IMusicMasterRepository
	):
		self.websocket_client = websocket_client
		self.inf_notebook_file_repository = inf_notebook_file_repository
		self.music_master_repository = music_master_repository

	def _generate_result_token(self) -> str:
		return str(uuid.uuid4()).replace("-", "") + str(int(time.time() * 1000))

	def execute(self, user_token: str, settings: Settings, content):
		result_data = None

		if settings.result_source == RESULT_SOURCE_DAKEN_COUNTER:
			root = ET.fromstring(content)
			first_item = root.find('item')
			if first_item is None:
				raise ValueError("XMLに<item>がありません")

			level = first_item.findtext('lv')
			song_name = first_item.findtext('title')
			difficulty_raw = first_item.findtext('difficulty')
			opt = first_item.findtext('opt')

			if difficulty_raw.startswith("SP"):
				play_style = "SP"
			elif difficulty_raw.startswith("DP"):
				play_style = "DB" if opt.startswith("BATTLE") else "DP"
			else:
				play_style = "UNKNOWN"

			diff_map = {"B": "BEGINNER", "N": "NORMAL", "H": "HYPER", "A": "ANOTHER", "L": "LEGGENDARIA"}
			difficulty = diff_map.get(difficulty_raw[-1], "UNKNOWN")

			result_data = {
				"mode": settings.mode,
				"roomId": settings.room_pass,
				"userId": user_token,
				"name": settings.djname,
				"resultToken": self._generate_result_token(),
				"result": {
					"level": level,
					"song_name": song_name,
					"play_style": play_style,
					"difficulty": difficulty,
					"score": first_item.findtext('score_cur'),
					"miss_count": first_item.findtext('bp'),
				}
			}
		elif settings.result_source == RESULT_SOURCE_INF_NOTEBOOK:
			record_json = json.loads(content)
			# 1. record.timestampsを取得
			timestamps = record_json.get("timestamps", [])
			if not timestamps:
				safe_print("No timestamps found.")
				return None
			timestamp = timestamps[-1]

			# 2. recordを取りに行く
			record_result = record_json.get("results", {}).get(timestamp)
			if not record_result:
				safe_print(f"recordにデータがありません: {timestamp}")
				return None

			# 3. exportを取りに行く
			export_json = self.inf_notebook_file_repository.load_export(settings.result_file)
			export_list = export_json.get("list", [])
			export_result = next((item for item in export_list if item.get("timestamp") == timestamp), None)
			if not export_result:
				safe_print(f"exportにデータがありません: {timestamp}")
				return None

			# 4. データ抽出＋デコード
			song_name = record_result.get("music")
			play_style = record_result.get("play_mode")
			difficulty = record_result.get("difficulty")
			score = export_result.get("score")
			miss_count = export_result.get("misscount")

			# 5. 曲マスタからデータ取得
			master = self.music_master_repository.get(song_name, play_style, difficulty)
			if not master:
				safe_print(f"マスタにデータがありません: {song_name} / {play_style} / {difficulty}")
				return None
			level = master.level

			# 6. リザルト生成
			result_data = {
				"mode": settings.mode,
				"roomId": settings.room_pass,
				"userId": user_token,
				"name": settings.djname,
				"resultToken": self._generate_result_token(),
				"result": {
					"level": level,
					"song_name": song_name,
					"play_style": play_style,
					"difficulty": difficulty,
					"score": score,
					"miss_count": miss_count,
				}
			}

		if result_data is None:
			safe_print("送信データが無いため送信できません")
			return
		safe_print("[送信データ]")
		safe_print(json.dumps(result_data, ensure_ascii=False, indent=2))
		return self.websocket_client.send(result_data)
