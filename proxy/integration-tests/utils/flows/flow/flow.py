import yaml
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any

from utils.consts import *
from utils.flows.flow import Filter, Processor


@dataclass
class FlowRef:
    name: str
    at: str


@dataclass
class StreamRef:
    name: str
    at: str


@dataclass
class ProcessorRef:
    name: str
    condition: Optional[str] = None


@dataclass
class Connection:
    stream: Optional[StreamRef] = None
    flow: Optional[FlowRef] = None
    processor: Optional[ProcessorRef] = None


@dataclass
class FlowConnection:
    from_: Connection
    to: Connection


@dataclass
class Flow:
    request: List[FlowConnection] = field(default_factory=list)
    response: List[FlowConnection] = field(default_factory=list)


@dataclass
class FlowRepresentation:
    name: Optional[str] = field(default=None)
    filter: Filter = field(default_factory=Filter)
    processors: Dict[str, Processor] = field(default_factory=dict)
    flow: Flow = field(default_factory=Flow)

    def add_processor(self, key: str, processor: Processor):
        self.processors[key] = processor

    def add_flow_request(self, from_: Connection, to: Connection):
        self.flow.request.append(FlowConnection(from_, to))

    def add_flow_response(self, from_: Connection, to: Connection):
        self.flow.response.append(FlowConnection(from_, to))

    def to_dict(self):
        def dict_factory(data: Any) -> Dict[str, Any]:
            return {
                k: v
                for k, v in data
                if v is not None and (not isinstance(v, list) or v)
            }

        return asdict(self, dict_factory=dict_factory)

    def build_yaml(self):
        def custom_represent_dict(dumper: Any, data: Any):
            new_data = {}
            for k, v in data.items():
                if isinstance(k, Enum):
                    k = str(k)
                if isinstance(v, Enum):
                    v = str(v)
                cleaned_key = k.rstrip("_")
                new_data[cleaned_key] = v
            return dumper.represent_dict(new_data)

        yaml.add_representer(dict, custom_represent_dict)
        return yaml.dump(
            self.to_dict(), default_flow_style=False, sort_keys=False, canonical=False
        )
