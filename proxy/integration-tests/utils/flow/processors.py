from dataclasses import dataclass
from typing import Optional, Dict, Union, List

from utils.flows import (
    KeyValue,
    KeyMapValue,
    Processor,
)


@dataclass
class QueueProcessor:
    quota_id: str
    ttl_seconds: int
    queue_size: int
    priority_group_by_header: Optional[str] = None
    priority_groups: Optional[Dict[str, int]] = None
    processor: str = "Queue"

    def get_condition_ok(self) -> str:
        return "allowed"

    def get_condition_bad(self) -> str:
        return "blocked"

    def get_processor(self) -> Processor:
        params: List[Union[KeyValue, KeyMapValue]] = [
            KeyValue(key="quota_id", value=self.quota_id),
            KeyValue(key="ttl_seconds", value=self.ttl_seconds),
            KeyValue(key="queue_size", value=self.queue_size),
        ]

        if self.priority_group_by_header and not self.priority_groups:
            raise ValueError(
                "priority_groups must be provided when priority_group_by_header is provided"
            )

        if not self.priority_group_by_header and self.priority_groups:
            raise ValueError(
                "group_by_header must be provided when priority_group_by_header is provided"
            )

        if self.priority_group_by_header and self.priority_groups:
            params.append(
                KeyValue(
                    key="priority_group_by_header", value=self.priority_group_by_header
                )
            )
            params.append(
                KeyMapValue(key="priority_groups", value=self.priority_groups)
            )

        return Processor(
            processor="Queue",
            parameters=params,
        )
