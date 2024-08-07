# type: ignore
from behave.api.async_step import async_run_until_complete
from utils.consts import SupportedProcessors, Conditions
from utils.resources.quota import *
from typing import Any, Optional
import uuid

from utils.flows import (
    KeyValue,
    FlowRepresentation,
    Filter,
    Processor,
    Connection,
    StreamRef,
    ProcessorRef,
)

QUOTA_ID = "quota_id"


def create_basic_rate_limit_flow(
    quota_id: str,
    url: str,
) -> FlowRepresentation:
    name = f"basic_rate_limit_flow_{uuid.uuid4()}"
    filter = Filter(url=url)
    flowRep = FlowRepresentation(name=name, filters=filter)

    procKeyTooManyRequests = (
        str(SupportedProcessors.GenerateResponse) + "TooManyRequests"
    )

    flowRep.add_processor(
        SupportedProcessors.Limiter,
        Processor(
            processor=SupportedProcessors.Limiter,
            parameters=[
                KeyValue(key=QUOTA_ID, value=quota_id),
            ],
        ),
    )
    flowRep.add_processor(
        procKeyTooManyRequests,
        Processor(
            processor=SupportedProcessors.GenerateResponse,
            parameters=[
                KeyValue(key="status", value=429),
                KeyValue(key="body", value="Too many requests"),
                KeyValue(key="Content-Type", value="text/plain"),
            ],
        ),
    )
    flowRep.add_processor(
        SupportedProcessors.GenerateResponse,
        Processor(SupportedProcessors.GenerateResponse),
    )

    flowRep.add_flow_request(
        from_=Connection(stream=StreamRef("globalStream", "start")),
        to=Connection(processor=ProcessorRef(SupportedProcessors.Limiter)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(SupportedProcessors.Limiter, Conditions.AboveLimit)
        ),
        to=Connection(processor=ProcessorRef(procKeyTooManyRequests)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(SupportedProcessors.Limiter, Conditions.BelowLimit)
        ),
        to=Connection(stream=StreamRef("globalStream", "end")),
    )

    flowRep.add_flow_response(
        from_=Connection(processor=ProcessorRef(procKeyTooManyRequests)),
        to=Connection(stream=StreamRef("globalStream", "end")),
    )

    flowRep.add_flow_response(
        from_=Connection(stream=StreamRef("globalStream", "start")),
        to=Connection(processor=ProcessorRef(SupportedProcessors.GenerateResponse)),
    )

    flowRep.add_flow_response(
        from_=Connection(processor=ProcessorRef(SupportedProcessors.GenerateResponse)),
        to=Connection(stream=StreamRef("globalStream", "end")),
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
