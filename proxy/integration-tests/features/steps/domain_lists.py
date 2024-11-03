# type: ignore

from typing import Any
from utils.policies import PoliciesRequests


@when("policies.yaml included allowed_domains list with {host}")
def step_impl(context: Any, host: str):
    policies_requests: PoliciesRequests = context.policies_requests
    policies_requests.domain_lists.allowed_domains.append(host)


@when("policies.yaml included blocked_domains list with {host}")
def step_impl(context: Any, host: str):
    policies_requests: PoliciesRequests = context.policies_requests
    policies_requests.domain_lists.blocked_domains.append(host)
