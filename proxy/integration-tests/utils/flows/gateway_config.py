import yaml
from dataclasses import dataclass, field
from typing import Any

from utils.consts import *
from toolkit_testing.integration_tests.docker import write_file


@dataclass
class DomainLists:
    allowed_domains: list[str] = field(default_factory=lambda: [])
    blocked_domains: list[str] = field(default_factory=lambda: [])


@dataclass
class GatewayConfigRequests:
    domain_lists: DomainLists = field(default_factory=DomainLists)

    def __init__(self):
        self.domain_lists = DomainLists()

    async def build_yaml(self):
        return await self._write_config_file(
            configuration_yaml={
                "allowed_domains": self.domain_lists.allowed_domains,
                "blocked_domains": self.domain_lists.blocked_domains,
            },
            container_name=LUNAR_PROXY_SERVICE_NAME,
        )

    async def _write_config_file(
        self,
        configuration_yaml: dict[str, Any],
        container_name: str = LUNAR_PROXY_SERVICE_NAME,
    ):
        print(f"config yaml:\n{yaml.dump(configuration_yaml)}")
        try:
            await write_file(
                container_name=container_name,
                directory_path=FLOWS_ROOT_DIRECTORY,
                file=ConfigFileName.CONFIG_FILENAME.value,
                content=yaml.dump(configuration_yaml, default_flow_style=False),
            )
        except Exception as e:
            print(f"Error writing config file: {e}")
            raise e

        return configuration_yaml
