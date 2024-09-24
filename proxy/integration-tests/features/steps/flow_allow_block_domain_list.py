# type: ignore
from behave.api.async_step import async_run_until_complete
from typing import Any, Optional
import uuid

from utils.flows.resources import *
from utils.flows.consts import GLOBAL_STREAM, START, END
from utils.flows.processors import (
    FilterProcessor,
    GenerateResponseProcessor,
)

from utils.flows.flow import (
    FlowRepresentation,
    Filter,
    Connection,
    StreamRef,
    ProcessorRef,
)


def create_domain_access_flow(
    allowed_domain: str,
    header_value: str,
) -> FlowRepresentation:
    name = f"domain_access_flow_{uuid.uuid4()}"
    filter = Filter(url="*")
    flowRep = FlowRepresentation(name=name, filters=filter)

    filter_processor_allow = FilterProcessor(url=allowed_domain)
    filter_processor_allow_key = filter_processor_allow.processor + "Allow"
    filter_processor_block = FilterProcessor(header_value=header_value)
    filter_processor_block_key = filter_processor_block.processor + "Block"
    generate_response_proc_forbidden = GenerateResponseProcessor(
        status=403, body="Forbidden"
    )
    proc_key_forbidden = generate_response_proc_forbidden.get_proc_key("Forbidden")

    generate_response_proc = GenerateResponseProcessor(
        status=200, body="OK", content_type="text/plain"
    )

    flowRep.add_processor(
        filter_processor_allow_key,
        filter_processor_allow.get_processor(),
    )
    flowRep.add_processor(
        filter_processor_block_key,
        filter_processor_block.get_processor(),
    )
    flowRep.add_processor(
        proc_key_forbidden,
        generate_response_proc_forbidden.get_processor(),
    )
    flowRep.add_processor(
        generate_response_proc.get_proc_key(),
        generate_response_proc.get_processor(),
    )

    flowRep.add_flow_request(
        from_=Connection(stream=StreamRef(GLOBAL_STREAM, START)),
        to=Connection(processor=ProcessorRef(filter_processor_allow_key)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                filter_processor_allow_key, filter_processor_allow.get_condition_bad()
            )
        ),
        to=Connection(processor=ProcessorRef(proc_key_forbidden)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                filter_processor_allow_key, filter_processor_allow.get_condition_ok()
            )
        ),
        to=Connection(processor=ProcessorRef(filter_processor_block_key)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                filter_processor_block_key, filter_processor_block.get_condition_bad()
            )
        ),
        to=Connection(stream=StreamRef(GLOBAL_STREAM, END)),
    )

    flowRep.add_flow_request(
        from_=Connection(
            processor=ProcessorRef(
                filter_processor_block_key, filter_processor_block.get_condition_ok()
            )
        ),
        to=Connection(processor=ProcessorRef(proc_key_forbidden)),
    )

    flowRep.add_flow_response(
        from_=Connection(processor=ProcessorRef(proc_key_forbidden)),
        to=Connection(stream=StreamRef(GLOBAL_STREAM, END)),
    )

    flowRep.add_flow_response(
        from_=Connection(stream=StreamRef(GLOBAL_STREAM, START)),
        to=Connection(processor=ProcessorRef(generate_response_proc.get_proc_key())),
    )

    flowRep.add_flow_response(
        from_=Connection(processor=ProcessorRef(generate_response_proc.get_proc_key())),
        to=Connection(stream=StreamRef(GLOBAL_STREAM, END)),
    )

    return flowRep


@when("Domain Access Control flow created with allowed {allowed_domain}")
@when(
    "Domain Access Control flow created with allowed {allowed_domain} and blocking header value {header_value}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    allowed_domain: str,
    header_value: Optional[str] = None,
):
    flowRep = create_domain_access_flow(
        allowed_domain=allowed_domain, header_value=header_value
    )
    context.flow = flowRep
