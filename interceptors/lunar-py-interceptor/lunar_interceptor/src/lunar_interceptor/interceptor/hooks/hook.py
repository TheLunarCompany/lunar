from typing import Dict, Optional
from abc import ABC, abstractmethod


class LunarHook(ABC):
    @staticmethod
    @abstractmethod
    def is_hook_supported() -> bool:
        pass

    @abstractmethod
    def init_hooks(self) -> None:
        pass

    @abstractmethod
    def remove_hooks(self) -> None:
        pass

    @abstractmethod
    async def make_connection(
        self, url: str, headers: Optional[Dict[str, str]]
    ) -> bool:
        pass
