from os import environ

import pytest

from lunar_interceptor.interceptor.helpers import load_env_value


@pytest.mark.asyncio
class TestHelpersComponent:
    async def test_load_env_value_no_env_found(self):
        value: int = load_env_value("test", int, 5)
        assert value == 5

    async def test_load_env_value_env_found(self):
        environ["LUNAR_TEST_VALUE_A"] = "1"
        value: int = load_env_value("LUNAR_TEST_VALUE_A", int, 5)
        assert value == 1
