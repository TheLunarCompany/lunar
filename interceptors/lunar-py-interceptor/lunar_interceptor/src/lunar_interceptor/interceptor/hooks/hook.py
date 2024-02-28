from typing import Dict, Optional
from abc import ABC, abstractmethod


class LunarHook(ABC):
    @staticmethod
    @abstractmethod
    def is_hook_supported() -> bool:
        pass

    @abstractmethod
    async def make_connection(
        self, url: str, headers: Optional[Dict[str, str]]
    ) -> bool:
        pass
