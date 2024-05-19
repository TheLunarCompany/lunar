import logging
from datetime import datetime

import pytest
from freezegun import freeze_time

from lunar_interceptor.interceptor.fail_safe import FailSafe


class ExceptionTestA(Exception):
    pass


class ExceptionTestB(Exception):
    pass


_DELTA_TIME = 10
_COOLDOWN_TIME = 2
_MAX_ERROR_ALLOWED = 3


@pytest.mark.asyncio
class TestInterceptorFailSafeComponent:
    async def test_enter_fail_safe(self):
        fail_safe = FailSafe(
            _COOLDOWN_TIME, _MAX_ERROR_ALLOWED, logging.getLogger(), (ExceptionTestA,)
        )

        assert fail_safe.state_ok

        for attempt in range(_MAX_ERROR_ALLOWED):
            with fail_safe:
                raise ExceptionTestA(f"Attempt - {attempt}")

        assert fail_safe.state_ok == False

    async def test_exit_fail_safe_after_cooldown(self):
        initial_datetime = datetime.now()
        with freeze_time(initial_datetime) as frozen_time:
            fail_safe = FailSafe(
                _COOLDOWN_TIME,
                _MAX_ERROR_ALLOWED,
                logging.getLogger(),
                (ExceptionTestB,),
            )

            for attempt in range(_MAX_ERROR_ALLOWED):
                with fail_safe:
                    raise ExceptionTestB(f"Attempt - {attempt}")

            assert fail_safe.state_ok == False

            frozen_time.tick(_DELTA_TIME)  # type: ignore [reportUnknownVariableType]

            assert fail_safe.state_ok

    async def test_fail_safe_handle_requierd_exceptions(self):
        fail_safe = FailSafe(
            _COOLDOWN_TIME, _MAX_ERROR_ALLOWED, logging.getLogger(), (ExceptionTestA,)
        )

        with fail_safe:
            raise ExceptionTestA("Attempt")

        with pytest.raises(ExceptionTestB):
            with fail_safe:
                raise ExceptionTestB("Attempt")

    async def test_fail_safe_enter_again_to_cooldown_after_first_connection_error(self):
        initial_datetime = datetime.now()
        with freeze_time(initial_datetime) as frozen_time:
            fail_safe = FailSafe(
                _COOLDOWN_TIME,
                _MAX_ERROR_ALLOWED,
                logging.getLogger(),
                (ExceptionTestA,),
            )

            assert fail_safe.state_ok

            for attempt in range(_MAX_ERROR_ALLOWED):
                with fail_safe:
                    raise ExceptionTestA(f"Attempt - {attempt}")

            assert fail_safe.state_ok == False

            frozen_time.tick(_DELTA_TIME)  # type: ignore [reportUnknownVariableType]

            assert fail_safe.state_ok

            with fail_safe:
                raise ExceptionTestA(f"Test")

            assert fail_safe.state_ok == False

    async def test_fail_safe_does_not_enter_again_to_cooldown_after_first_connection_succeeded(
        self,
    ):
        initial_datetime = datetime.now()
        with freeze_time(initial_datetime) as frozen_time:
            fail_safe = FailSafe(
                _COOLDOWN_TIME,
                _MAX_ERROR_ALLOWED,
                logging.getLogger(),
                (ExceptionTestA,),
            )

            assert fail_safe.state_ok

            for attempt in range(_MAX_ERROR_ALLOWED):
                with fail_safe:
                    raise ExceptionTestA(f"Attempt - {attempt}")

            assert fail_safe.state_ok == False

            frozen_time.tick(_DELTA_TIME)  # type: ignore [reportUnknownVariableType]

            assert fail_safe.state_ok

            with fail_safe:
                pass

            assert fail_safe.state_ok
