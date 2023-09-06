import time
import uuid
from dataclasses import asdict, dataclass
from json import dumps
from aiohttp import web


##################################################
##                Logic Mock Server             ##
##----------------------------------------------##
## This server is aimed as standing in for      ##
## Lunar Proxy. It helps in mocking when more   ##
## Elaborate logic is required, such as retry   ##
## protocol implementation.                     ##
##################################################

PORT = 9000

CONTENT_TYPE = "application/json"
MANAGED = "managed"


def run():
    app = web.Application()
    app.add_routes(
        [
            web.get("/anything/retry/init", _retry_init),
            web.get("/anything/retry/attempt", _retry_attempt),
            web.get("/healthcheck", _healthcheck),
            web.get("/handshake", _handshake),
            web.get("/uuid", _uuid),
            web.get("/headers", _headers),
        ]
    )
    print(f"logic-mock-server is up at port {PORT}")
    web.run_app(app, port=PORT)  # type: ignore


_SUCCESSFUL_RESPONSE = {"message": "OK"}


_INITIAL_RETRY_AFTER_VALUE = "0"


@dataclass
class RetryConfig:
    initialized: bool = False
    retry_after_value: str = _INITIAL_RETRY_AFTER_VALUE
    attempts_count: int = 0


@dataclass
class RetryState:
    attempts_left: int
    first_call_time: float
    call_count: int


retry_config = RetryConfig()
retry_states: dict[str, RetryState] = {}


async def _retry_init(request: web.Request) -> web.Response:
    try:
        # extract and validate
        raw_retry_attempts_left = request.rel_url.query["attempts_count"]
        attempts_count = int(raw_retry_attempts_left)
        retry_after_value = request.rel_url.query["retry_after_value"]
        assert retry_after_value is not None

    except ValueError as ex:
        message = f"could not /retry/init: {ex}"
        print(message)
        return _build_error(status=400, message=message)

    # init config
    retry_config.initialized = True
    retry_config.attempts_count = attempts_count
    retry_config.retry_after_value = retry_after_value

    message = "/retry/init succeeded"
    print(f"{message} with val: {request.rel_url}")
    return web.Response(
        status=200, body=dumps({"message": message}), content_type=CONTENT_TYPE
    )


async def _retry_attempt(request: web.Request) -> web.Response:
    if not retry_config.initialized:
        message = "must call /retry/init first"
        print(message)
        return _build_error(status=400, message=message)

    sequence_id = request.headers.get("x-lunar-sequence-id") or str(uuid.uuid1())
    if not retry_states.get(sequence_id):
        retry_states[sequence_id] = RetryState(
            attempts_left=retry_config.attempts_count,
            first_call_time=time.time() * 1000,
            call_count=0,
        )

    retry_state = retry_states[sequence_id]
    retry_state.call_count = retry_state.call_count + 1

    headers = {"x-lunar-sequence-id": sequence_id}

    ms_since_first_call = (time.time() * 1000) - retry_state.first_call_time
    if retry_state.attempts_left > 0:
        retry_state.attempts_left = retry_state.attempts_left - 1
        headers["x-lunar-retry-after"] = retry_config.retry_after_value

    body = {
        "ms_since_first_call": ms_since_first_call,
        "retry_state": asdict(retry_state),
    }
    print(body)
    return web.Response(
        status=200, body=dumps(body), headers=headers, content_type=CONTENT_TYPE
    )


async def _healthcheck(_: web.Request) -> web.Response:
    return web.Response(
        status=200, body=dumps(_SUCCESSFUL_RESPONSE), content_type=CONTENT_TYPE
    )


async def _uuid(_: web.Request) -> web.Response:
    return web.Response(
        status=200,
        body=dumps({"uuid": "fake_uuid_from_proxy"}),
        content_type=CONTENT_TYPE,
    )


async def _handshake(request: web.Request) -> web.Response:
    headers = request.headers
    lunar_tenant_id = headers.get("x-lunar-tenant-id", "unknown")

    if lunar_tenant_id == MANAGED:
        return web.Response(
            status=200,
            body=dumps({**_SUCCESSFUL_RESPONSE, **{MANAGED: True}}),
            content_type=CONTENT_TYPE,
        )
    else:
        return web.Response(
            status=200,
            body=dumps({**_SUCCESSFUL_RESPONSE, **{MANAGED: False}}),
            content_type=CONTENT_TYPE,
        )


async def _headers(request: web.Request) -> web.Response:
    return web.Response(
        status=200,
        body=dumps({"headers": dict(request.headers)}),
        content_type=CONTENT_TYPE,
    )


def _build_error(status: int, message: str) -> web.Response:
    return web.Response(
        status=status, body=dumps({"message": message}), content_type=CONTENT_TYPE
    )
