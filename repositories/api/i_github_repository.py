from abc import ABC, abstractmethod

class IGithubRepository(ABC):
    @abstractmethod
    def get_latest_release(self):
        """
        githubからlatest版情報を取得する
        """
        pass
    
    def download_zip(self, asset_url) -> str:
        """
        latest版zipファイルを取得する
        """
        pass