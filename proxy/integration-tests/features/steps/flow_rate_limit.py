# type: ignore
from behave.api.async_step import async_run_until_complete
from typing import Any, Optional, Dict
import uuid

from utils.consts import *
from utils.flows.resources import *
from utils.flows import write_resource_file
from utils.flows.consts import GLOBAL_STREAM, START, END
from utils.flows.processors import (
    LimiterProcessor,
    GenerateResponseProcessor,
)

from utils.flows.flow import (
    FlowRepresentation,
    Filter,
    Connection,
    StreamRef,
    ProcessorRef,
)


def create_basic_rate_limit_flow(
    quota_id: str,
    url: str,
) -> FlowRepresentation:
    name = f"basic_rate_limit_flow_{uuid.uuid4()}"
    filter = Filter(url=url)
    flowRep = FlowRepresentation(name=name, filter=filter)

    limiter_processor = LimiterProcessor(quota_id=quota_id)
    limiter_processor_name = limiter_processor.processor + name
    generate_response_processor = GenerateResponseProcessor()
    generate_response_processor_name = (
        generate_response_processor.processor + "TooManyRequests" + name
    )

    flowRep.add_processor(
        limiter_processor_name,
        limiter_processor.get_processor(),
    )
    flowRep.add_processor(
        generate_response_processor_name,
        generate_response_processor.get_processor(),
    )

    flowRep.add_flow_request(
        from_=Connection(stream=StreamRef(GLOBAL_STREAM, START)),
        to=Connection(processor=ProcessorRef(limiter_processor_name)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                limiter_processor_name, limiter_processor.get_condition_bad()
            )
        ),
        to=Connection(processor=ProcessorRef(generate_response_processor_name)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                limiter_processor_name, limiter_processor.get_condition_ok()
            )
        ),
        to=Connection(stream=StreamRef(GLOBAL_STREAM, END)),
    )

    flowRep.add_flow_response(
        from_=Connection(processor=ProcessorRef(generate_response_processor_name)),
        to=Connection(stream=StreamRef(GLOBAL_STREAM, END)),
    )

    flowRep.add_flow_response(
        from_=Connection(stream=StreamRef(GLOBAL_STREAM, START)),
        to=Connection(stream=StreamRef(GLOBAL_STREAM, END)),
    )

    return flowRep


@given(
    "Fixed Window parent for {url} with ID: {quota_id} and {allowed_requests:Int} requests per {time_window:Int} {time_unit} added to {file_name}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    url: str,
    quota_id: str,
    allowed_requests: int,
    time_window: int,
    time_unit: str,
    file_name: str,
):
    if not hasattr(context, "quota_resources"):
        context.quota_resources: Dict[str, ResourceQuotaRepresentation] = {}

    if file_name not in context.quota_resources:
        context.quota_resources[file_name] = ResourceQuotaRepresentation()

    filer = Filter(url=url)

    fixed_strategy = FixedWindowConfig(
        max=allowed_requests,
        interval=time_window,
        interval_unit=time_unit,
    )

    quota_config = QuotaConfig(
        id=quota_id, filter=filer, strategy=StrategyConfig(fixed_window=fixed_strategy)
    )

    context.quota_resources[file_name].add_quota(quota_config)


@when("Quota file {file_name} is saved")
@async_run_until_complete
async def step_impl(context: Any, file_name: str):
    if not hasattr(context, "quota_resources"):
        assert False, "No quota resources created"

    quota_resource = context.quota_resources.get(file_name, None)
    assert quota_resource is not None, f"Quota resource {file_name} not found"

    resource_yaml = quota_resource.build_yaml()
    print(f"resource yaml:\n{resource_yaml}")
    await write_resource_file(
        filename=file_name, resource_yaml=resource_yaml, directory_path=QUOTAS_DIRECTORY
    )


@when("Basic rate limit flow created for {url} linked to quota ID: {quota_id}")
@async_run_until_complete
async def step_impl(context: Any, url: str, quota_id: str):
    flowRep = create_basic_rate_limit_flow(quota_id=quota_id, url=url)
    context.flow = flowRep


@when(
    "Basic rate limit flow created for {url} with {allowed_requests:Int} requests per {time_window:Int} seconds"
)
@when(
    "Basic rate limit flow created for {url} with {allowed_requests:Int} requests per {time_window:Int} seconds and spillover with max of {spillover_count:Int}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    url: str,
    allowed_requests: int,
    time_window: int,
    spillover_count: Optional[
        int
    ] = None,  # TODO: Add spillover_enabled to the function signature
):
    spillover = None
    monthly_renewal = None
    if spillover_count is not None:
        spillover = Spillover(max=spillover_count)
        monthly_renewal = MonthlyRenewalData(day=10, hour=0, minute=0, timezone="UTC")

    quota_id = str(uuid.uuid4())
    flowRep = create_basic_rate_limit_flow(quota_id=quota_id, url=url)
    context.flow = flowRep
    filer = Filter(url=url)

    fixed_strategy = FixedWindowConfig(
        max=allowed_requests,
        interval=time_window,
        interval_unit="second",
        spillover=spillover,
        monthly_renewal=monthly_renewal,
    )
    quota_config = QuotaConfig(
        id=quota_id, filter=filer, strategy=StrategyConfig(fixed_window=fixed_strategy)
    )
    context.resource = ResourceQuotaRepresentation()
    context.resource.add_quota(quota_config)
