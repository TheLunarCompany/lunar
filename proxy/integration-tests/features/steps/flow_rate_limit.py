# type: ignore
from behave.api.async_step import async_run_until_complete
from typing import Any, Optional
import uuid

from utils.flows.resources import *
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
