from abc import ABC, abstractmethod

class IMainViewController(ABC):
    @abstractmethod
    def on_create(self):
        """
        画面生成時に呼ばれる初期化処理（設定ロード＋UI初期化）
        """
        pass
    
    @abstractmethod
    def validate_djname(self):
        """
            DJNAMEが変更された際のUI処理
        """
        pass
    
    @abstractmethod
    def validate_room_pass(self):
        """
            ルームパスが変更された際のUI処理
        """
        pass
    
    @abstractmethod
    def change_mode(self):
        """
            対戦モードが変更された際のUI処理
        """
        pass
    
    @abstractmethod
    def select_result_dir(self, e):
        """
            フォルダ選択でディレクトリが選択された際のUI処理
        """
        pass
    
    @abstractmethod
    def validate_inputs(self):
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
    def generate_room_pass(self):
        """
            ルームパス生成ボタン押下時の処理
        """
        pass
    
    @abstractmethod
    async def skip_song(self, song_id): 
        """
            スキップボタン押下時の処理
        """
    @abstractmethod
    async def delete_song(self, song_id): 
        """
            削除ボタン押下時の処理
        """