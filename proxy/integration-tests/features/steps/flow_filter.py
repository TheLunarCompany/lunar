# type: ignore
from behave.api.async_step import async_run_until_complete
from behave import given

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

@given("Filter with {id} defined with url {url}")
@async_run_until_complete
async def step_impl(context: Any, id: str, url: str):
    filterID = f"filter_{id}"
    if not hasattr(context, "filters"):
      context.filters = {}
      
    context.filters[filterID] = Filter(url=url)
    
@given("Filter with {id} accepts expression: {expr}")
@async_run_until_complete
async def step_impl(context: Any, id: str, expr: str):
    filterID = f"filter_{id}"
    assert filterID in context.filters, f"Filter {filterID} not found"
    context.filters[filterID].expressions = [expr]