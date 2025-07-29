from abc import ABC, abstractmethod


class IMasterUpdateUsecase(ABC):
    @abstractmethod
    async def execute(self):
        """
        マスタ更新を行う
        """