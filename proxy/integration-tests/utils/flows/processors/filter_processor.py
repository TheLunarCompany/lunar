from dataclasses import dataclass
from typing import Union, List

from utils.flows.flow import (
    KeyValue,
    KeyMapValue,
    Processor,
)


@dataclass
class FilterProcessor:
    url: str = ""
    header_value: str = ""
    processor: str = "Filter"

    def get_condition_ok(self) -> str:
        return "hit"

    def get_condition_bad(self) -> str:
        return "miss"

    def get_processor(self) -> Processor:
        params: List[Union[KeyValue, KeyMapValue]] = []

        if self.url:
            params.append(KeyValue(key="url", value=self.url))

        # Add 'header' if it has a value
        if self.header_value:
            params.append(KeyValue(key="header", value=self.header_value))

        return Processor(
            processor=self.processor,
            parameters=params,
        )
