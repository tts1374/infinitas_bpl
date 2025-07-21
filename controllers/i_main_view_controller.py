from abc import ABC, abstractmethod

class IMainViewController(ABC):
    @abstractmethod
    def on_create(self):
        """
        画面生成時に呼ばれる初期化処理（設定ロード＋UI初期化）
        """
        pass
    
    @abstractmethod
    def on_mode_change(self):
        """
            対戦モードが変更された際のUI処理
        """
        pass
    
    @abstractmethod
    def pick_result_file(self, e):
        """
            ファイル選択でファイルが選択された際のUI処理
        """
        pass
    
    @abstractmethod
    def validate_all_inputs(self):
        """
            入力可能な入力値が変更された際のUI処理
        """
        pass
    
    @abstractmethod
    async def start_battle(self, e):
        """
            対戦開始時のUI処理
        """
        pass
    
    @abstractmethod
    async def stop_battle(self, e):
        """
            対戦終了時の処理
        """
        pass
    
    @abstractmethod
    def create_room_pass_button(self):
        """
            ルームパス生成ボタン押下時の処理
        """
        pass