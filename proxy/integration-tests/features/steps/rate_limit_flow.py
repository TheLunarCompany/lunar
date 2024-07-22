# type: ignore
from behave.api.async_step import async_run_until_complete
from utils.consts import SupportedProcessors, Conditions
from typing import Any
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


ALLOWED_REQUESTS_PARAM = "allowed_request_count"
WINDOW_SIZE_PARAM = "window_size_in_seconds"


def create_basic_rate_limit_flow(
    allowed_requests: int,
    time_window_sec: int,
    url: str,
) -> FlowRepresentation:
    name = f"basic_rate_limit_flow_{uuid.uuid4()}"
    filter = Filter(url=url)
    flowRep = FlowRepresentation(name=name, filters=filter)

    procKeyTooManyRequests = (
        str(SupportedProcessors.GenerateResponse) + "TooManyRequests"
    )

    flowRep.add_processor(
        SupportedProcessors.BasicRateLimiter,
        Processor(
            processor=SupportedProcessors.BasicRateLimiter,
            parameters=[
                KeyValue(key=ALLOWED_REQUESTS_PARAM, value=allowed_requests),
                KeyValue(key=WINDOW_SIZE_PARAM, value=time_window_sec),
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
        to=Connection(processor=ProcessorRef(SupportedProcessors.BasicRateLimiter)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                SupportedProcessors.BasicRateLimiter, Conditions.AboveLimit
            )
        ),
        to=Connection(processor=ProcessorRef(procKeyTooManyRequests)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                SupportedProcessors.BasicRateLimiter, Conditions.BelowLimit
            )
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
@async_run_until_complete
async def step_impl(
    context: Any,
    url: str,
    allowed_requests: int,
    time_window: int,
):
    flowRep = create_basic_rate_limit_flow(allowed_requests, time_window, url)
    context.flow = flowRep
