import yaml
from dataclasses import dataclass, field
from typing import Any, Optional

from utils.consts import *
from toolkit_testing.integration_tests.docker import write_file, read_file


@dataclass
class GlobalPolicy:
    remedies: list[Any] = field(default_factory=lambda: [])
    diagnosis: list[Any] = field(default_factory=lambda: [])


@dataclass
class EndpointPolicy:
    method: str
    url: str
    remedies: list[Any] = field(default_factory=lambda: [])
    diagnosis: list[Any] = field(default_factory=lambda: [])


@dataclass
class Header:
    name: Optional[str]
    value: Optional[str]


@dataclass
class Body:
    name: Optional[str]
    value: Optional[str]


@dataclass
class Token:
    header: Header


@dataclass
class OAuth:
    tokens: list[Body] = field(default_factory=lambda: [])


@dataclass
class BasicAuth:
    username: Optional[str]
    password: Optional[str]


@dataclass
class APIKey:
    tokens: list[Header] = field(default_factory=lambda: [])


@dataclass
class Authentication:
    o_auth: Optional[OAuth] = field(default=None)
    api_key: Optional[APIKey] = field(default=None)
    basic: Optional[BasicAuth] = field(default=None)


@dataclass
class Account:
    tokens: list[Token] = field(default_factory=lambda: [])
    authentication: Optional[Authentication] = field(default=None)


@dataclass
class PoliciesRequests:
    # should be `global`, however it is a reserved word in Python
    globals: GlobalPolicy = field(default_factory=lambda: GlobalPolicy())
    endpoints: list[EndpointPolicy] = field(default_factory=lambda: [])
    accounts: dict[str, Account] = field(default_factory=lambda: {})
    exporters: dict[str, Any] = field(default_factory=lambda: {})

    def build_yaml(self) -> dict[str, Any]:
        endpoints_by_endpoint: dict[tuple[str, str], list[EndpointPolicy]] = {}
        for endpoint in self.endpoints:
            if not (endpoint.method, endpoint.url) in endpoints_by_endpoint:
                endpoints_by_endpoint[(endpoint.method, endpoint.url)] = []
            endpoints_by_endpoint[(endpoint.method, endpoint.url)].append(endpoint)

        def merge_endpoint_policies(
            method: str, url: str, policies: list[EndpointPolicy]
        ) -> EndpointPolicy:
            merged_policy = EndpointPolicy(
                method=method, url=url, remedies=[], diagnosis=[]
            )
            for policy in policies:
                merged_policy.remedies.extend(policy.remedies)
                merged_policy.diagnosis.extend(policy.diagnosis)

            return merged_policy

        merged_endpoints = [
            merge_endpoint_policies(k[0], k[1], v)
            for (k, v) in endpoints_by_endpoint.items()
        ]

        return {
            "global": self.globals,
            "endpoints": merged_endpoints,
            "accounts": self.accounts,
            "exporters": self.exporters,
        }


async def read_actual_policies_file() -> dict[str, Any]:
    return await _read_policies_file(
        policies_filename=PoliciesFilename.ACTUAL_POLICIES_FILENAME
    )


async def read_initial_policies_file() -> dict[str, Any]:
    return await _read_policies_file(
        policies_filename=PoliciesFilename.INITIAL_POLICIES_FILENAME
    )


async def _read_policies_file(
    policies_filename: PoliciesFilename, container_name: str = LUNAR_PROXY_SERVICE_NAME
) -> dict[str, Any]:
    existing_policies_file = await read_file(
        container_name=container_name,
        directory_path=POLICIES_DIRECTORY,
        file=policies_filename.value,
    )
    return yaml.safe_load(existing_policies_file)


async def write_actual_policies_file(
    policies_yaml: dict[str, Any], container_name: str = LUNAR_PROXY_SERVICE_NAME
):
    return await _write_policies_file(
        policies_filename=PoliciesFilename.ACTUAL_POLICIES_FILENAME,
        policies_yaml_str=yaml.dump(policies_yaml, default_flow_style=False),
        container_name=container_name,
    )


async def write_initial_policies_file(
    policies_yaml: str, container_name: str = LUNAR_PROXY_SERVICE_NAME
):
    return await _write_policies_file(
        policies_filename=PoliciesFilename.INITIAL_POLICIES_FILENAME,
        policies_yaml_str=policies_yaml,
        container_name=container_name,
    )


async def _write_policies_file(
    policies_filename: PoliciesFilename,
    policies_yaml_str: str,
    container_name: str = LUNAR_PROXY_SERVICE_NAME,
):
    await write_file(
        container_name=container_name,
        directory_path=POLICIES_DIRECTORY,
        file=policies_filename.value,
        content=policies_yaml_str,
    )
