import yaml
from dataclasses import dataclass, field, asdict
from typing import Any, List, Dict, Optional
from utils.consts import *
from utils.flows.flow import Filter


@dataclass
class MonthlyRenewalData:
    day: int
    hour: int
    minute: int
    timezone: str


@dataclass
class Spillover:
    max: int


@dataclass
class QuotaLimit:
    max: int
    interval: int
    interval_unit: str
    spillover: Optional[Spillover] = None


@dataclass
class InternalLimit(QuotaLimit):
    id: str = ""
    parent_id: str = ""
    filter: Optional[Filter] = None


@dataclass
class FixedWindowConfig(QuotaLimit):
    group_by_header: Optional[str] = None
    monthly_renewal: Optional[MonthlyRenewalData] = None


@dataclass
class ConcurrentConfig:
    max: int


@dataclass
class HeaderBasedConfig:
    header: str
    value: str


@dataclass
class StrategyConfig:
    fixed_window: Optional[FixedWindowConfig] = None
    concurrent: Optional[ConcurrentConfig] = None
    header_based: Optional[HeaderBasedConfig] = None
    allocation_percentage: Optional[int] = 0


@dataclass
class QuotaConfig:
    id: str
    filter: Filter
    strategy: StrategyConfig


@dataclass
class ChildQuotaConfig(QuotaConfig):
    parent_id: str


@dataclass
class ResourceQuotaRepresentation:
    quotas: List[QuotaConfig] = field(default_factory=list)
    internal_limits: List[ChildQuotaConfig] = field(default_factory=list)

    def add_quota(self, quota: QuotaConfig):
        self.quotas.append(quota)

    def add_child_limit(self, limit: ChildQuotaConfig):
        self.internal_limits.append(limit)

    def to_dict(self) -> Dict[Any, Any]:
        def dict_factory(data: Any) -> Dict[Any, Any]:
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
