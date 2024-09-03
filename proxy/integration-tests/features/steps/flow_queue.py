# type: ignore
from behave.api.async_step import async_run_until_complete
from typing import Any, Optional, Dict
import uuid
import json

from utils.flows.resources import *
from utils.flows.consts import GLOBAL_STREAM, START, END
from utils.flows.processors import QueueProcessor, GenerateResponseProcessor
from utils.flows.flow import (
    FlowRepresentation,
    Filter,
    Connection,
    StreamRef,
    ProcessorRef,
)


def create_basic_queue_flow(
    quota_id: str,
    ttl_seconds: int,
    queue_size: int,
    filter: Filter,
    group_by_header: Optional[str] = None,
    groups: Optional[Dict[str, int]] = None,
) -> FlowRepresentation:
    name = f"basic_queue_flow_{uuid.uuid4()}"
    flowRep = FlowRepresentation(name=name, filters=filter)

    queue_processor = QueueProcessor(
        quota_id=quota_id,
        ttl_seconds=ttl_seconds,
        queue_size=queue_size,
        priority_group_by_header=group_by_header,
        priority_groups=groups,
    )
    generate_response_processor = GenerateResponseProcessor()

    procKeyTooManyRequests = (
        str(generate_response_processor.processor) + "TooManyRequests"
    )

    flowRep.add_processor(
        queue_processor.processor,
        queue_processor.get_processor(),
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
        to=Connection(processor=ProcessorRef(queue_processor.processor)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                queue_processor.processor, queue_processor.get_condition_bad()
            )
        ),
        to=Connection(processor=ProcessorRef(procKeyTooManyRequests)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                queue_processor.processor, queue_processor.get_condition_ok()
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
    "Queue flow created for {method} {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds with queue args: ttl={ttl_sec:Int},queue_size={queue_size:Int}"
)
@when(
    "Queue flow created for {method} {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds with queue args: ttl={ttl_sec:Int},queue_size={queue_size:Int},group_by_header={group_by_header},groups={groups}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    allowed_requests: int,
    time_window: int,
    ttl_sec: int,
    queue_size: int,
    group_by_header: Optional[str] = None,
    groups: Optional[str] = None,
):
    quota_id = str(uuid.uuid4())

    filter = Filter(
        url=f"{host}{path}",
        method=[
            method,
        ],
    )
    if groups:
        groups = json.loads(groups)

    flowRep = create_basic_queue_flow(
        quota_id=quota_id,
        filter=filter,
        ttl_seconds=ttl_sec,
        queue_size=queue_size,
        group_by_header=group_by_header,
        groups=groups,
    )
    context.flow = flowRep

    fixed_strategy = FixedWindowConfig(
        max=allowed_requests,
        interval=time_window,
        interval_unit="second",
    )
    quota_config = QuotaConfig(
        id=quota_id, filter=filter, strategy=StrategyConfig(fixed_window=fixed_strategy)
    )
    context.resource = ResourceQuotaRepresentation(quota=quota_config)
    context.window_size = time_window
