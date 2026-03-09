from dataclasses import dataclass
from typing import Optional, Union, List
from utils.flows.flow import KeyValue, KeyMapValue, Processor


@dataclass
class GenerateResponseProcessor:
    status: int = 429
    body: str = "Too Many Requests"
    processor: str = "GenerateResponse"
    content_type: str = "text/plain"

    def get_condition_ok(self) -> str:
        return ""

    def get_condition_bad(self) -> str:
        return ""

    def get_proc_key(self, appendix: Optional[str] = "") -> str:
        return f"GenerateResponse{appendix}"

    def get_processor(self) -> Processor:
        params: List[Union[KeyValue, KeyMapValue]] = [
            KeyValue(key="status", value=self.status),
            KeyValue(key="body", value=self.body),
            KeyValue(key="Content-Type", value=self.content_type),
        ]

        return Processor(
            processor=self.processor,
            parameters=params,
        )
