import yaml
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Union, Any

# from consts import *
from utils.consts import *
from toolkit_testing.integration_tests.docker import write_file, read_file


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

    def to_dict(self):
        def dict_factory(data):
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
    query_params: List[KeyValue] = field(default_factory=list)
    method: List[str] = field(default_factory=list)
    headers: List[KeyValue] = field(default_factory=list)
    status_code: List[int] = field(default_factory=list)


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
    name: str
    filters: Filter
    processors: Dict[str, Processor] = field(default_factory=dict)
    flow: Flow = field(default_factory=Flow)

    def add_processor(self, key: str, processor: Processor):
        self.processors[key] = processor

    def add_flow_request(self, from_: Connection, to: Connection):
        self.flow.request.append(FlowConnection(from_, to))

    def add_flow_response(self, from_: Connection, to: Connection):
        self.flow.response.append(FlowConnection(from_, to))

    def to_dict(self):
        def dict_factory(data):
            return {
                k: v
                for k, v in data
                if v is not None and (not isinstance(v, list) or v)
            }

        return asdict(self, dict_factory=dict_factory)

    def build_yaml(self):
        def custom_represent_dict(dumper, data):
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


async def read_flow_file(
    flow_filename: str, container_name: str = LUNAR_PROXY_SERVICE_NAME
) -> str:
    existing_policies_file = await read_file(
        container_name=container_name,
        directory_path=FLOWS_DIRECTORY,
        file=flow_filename,
    )
    return yaml.safe_load(existing_policies_file)


async def write_flow_file(
    flow_filename: str,
    flow_yaml: str,
    container_name: str = LUNAR_PROXY_SERVICE_NAME,
):
    await write_file(
        container_name=container_name,
        directory_path=FLOWS_DIRECTORY,
        file=flow_filename,
        content=flow_yaml,
    )
