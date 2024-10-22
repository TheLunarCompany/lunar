from dataclasses import dataclass, field, asdict
from typing import List, Dict, Union, Any, Optional


@dataclass
class KeyValue:
    key: str
    value: Union[str, int, Dict[str, Any]]


@dataclass
class KeyMapValue:
    key: str
    value: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Processor:
    processor: str
    parameters: List[Union[KeyValue, KeyMapValue]] = field(default_factory=list)
    metrics: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        def dict_factory(data: Any) -> Dict[str, Any]:
            return {
                k: v
                for k, v in data
                if v is not None and (not isinstance(v, list) or v)
            }

        return asdict(self, dict_factory=dict_factory)


@dataclass
class Filter:
    name: Optional[str] = None
    url: Optional[str] = None
    query_params: List["KeyValue"] = field(default_factory=list)
    method: List[str] = field(default_factory=list)
    headers: List["KeyValue"] = field(default_factory=list)
    status_code: List[int] = field(default_factory=list)
