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
    flowRep = FlowRepresentation(name=name, filters=filter)

    limiter_processor = LimiterProcessor(quota_id=quota_id)
    generate_response_processor = GenerateResponseProcessor()
    procKeyTooManyRequests = generate_response_processor.processor + "TooManyRequests"

    flowRep.add_processor(
        limiter_processor.processor,
        limiter_processor.get_processor(),
    )
    flowRep.add_processor(
        procKeyTooManyRequests,
        generate_response_processor.get_processor(),
    )
    flowRep.add_processor(
        generate_response_processor.processor,
        generate_response_processor.get_processor(),
    )

    flowRep.add_flow_request(
        from_=Connection(stream=StreamRef(GLOBAL_STREAM, START)),
        to=Connection(processor=ProcessorRef(limiter_processor.processor)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                limiter_processor.processor, limiter_processor.get_condition_bad()
            )
        ),
        to=Connection(processor=ProcessorRef(procKeyTooManyRequests)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                limiter_processor.processor, limiter_processor.get_condition_ok()
            )
        ),
        to=Connection(stream=StreamRef(GLOBAL_STREAM, END)),
    )

    flowRep.add_flow_response(
        from_=Connection(processor=ProcessorRef(procKeyTooManyRequests)),
        to=Connection(stream=StreamRef(GLOBAL_STREAM, END)),
    )

    flowRep.add_flow_response(
        from_=Connection(stream=StreamRef(GLOBAL_STREAM, START)),
        to=Connection(processor=ProcessorRef(generate_response_processor.processor)),
    )

    flowRep.add_flow_response(
        from_=Connection(processor=ProcessorRef(generate_response_processor.processor)),
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
    context.resource = ResourceQuotaRepresentation(quota=quota_config)
