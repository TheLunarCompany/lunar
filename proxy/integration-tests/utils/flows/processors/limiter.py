from dataclasses import dataclass
from typing import Union, List

from utils.flows.flow import (
    KeyValue,
    KeyMapValue,
    Processor,
)


@dataclass
class LimiterProcessor:
    quota_id: str
    processor: str = "Limiter"

    def get_condition_ok(self) -> str:
        return "below_limit"

    def get_condition_bad(self) -> str:
        return "above_limit"

    def get_processor(self) -> Processor:
        params: List[Union[KeyValue, KeyMapValue]] = [
            KeyValue(key="quota_id", value=self.quota_id),
        ]

        return Processor(
            processor=self.processor,
            parameters=params,
        )
