import logging

import pytest

from lunar_interceptor.interceptor.traffic_filter import TrafficFilter

_LOGGER = logging.getLogger()


@pytest.mark.asyncio
class TestInterceptorTrafficFilterComponent:
    async def test_traffic_filter_parser_with_valid_values(self):
        raw_allow_list = "www.google.com,google.com,192.168.24.24"
        raw_block_list = "www.no.com,www.no-no.net"

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert traffic_filter.is_allowed("www.google.com")
        assert traffic_filter.is_allowed("google.com")
        assert traffic_filter.is_allowed("192.168.24.24")

        assert not traffic_filter.is_allowed("www.no.com")
        assert not traffic_filter.is_allowed("www.no-no.net")

        assert not traffic_filter.is_allowed("www.should-block.net")
        assert not traffic_filter.is_allowed("www.not-allowed.net")

    async def test_traffic_filter_parser_with_invalid_url_values(self):
        raw_allow_list = "www.google.c,google.com"
        raw_block_list = "www.no.com,wno."

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False
        assert not traffic_filter.is_allowed("www.google.com")
        assert traffic_filter.is_allowed("google.com")

        assert not traffic_filter.is_allowed("www.no.com")
        assert not traffic_filter.is_allowed("www.no-no.net")

        assert not traffic_filter.is_allowed("www.should-block.net")
        assert not traffic_filter.is_allowed("www.not-allowed.net")

        assert not traffic_filter.is_allowed("www.google.c")
        assert not traffic_filter.is_allowed("wno.")

    async def test_traffic_filter_parser_with_1_invalid_and_1_valid_ip_value_on_allow_list(
        self,
    ):
        raw_allow_list = "192.125,124.4555,127.0.0.1"
        raw_block_list = ""

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False
        assert not traffic_filter.is_allowed("www.google.com")
        assert not traffic_filter.is_allowed("google.com")

        assert not traffic_filter.is_allowed("192.125")
        assert not traffic_filter.is_allowed("124.4555")
        assert not traffic_filter.is_allowed("192.125,124.4555")

        assert not traffic_filter.is_allowed("www.should-block.net")
        assert not traffic_filter.is_allowed("www.not-allowed.net")

        assert not traffic_filter.is_allowed("www.google.c")
        assert not traffic_filter.is_allowed("wno.")
        assert traffic_filter.is_allowed("127.0.0.1")

    async def test_traffic_filter_parser_with_1_invalid_value_on_allow_list(self):
        raw_allow_list = "192.125,124.4555"
        raw_block_list = ""

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("www.google.com")
        assert not traffic_filter.is_allowed("google.com")

        assert not traffic_filter.is_allowed("192.125")
        assert not traffic_filter.is_allowed("124.4555")
        assert not traffic_filter.is_allowed("192.125,124.4555")

        assert not traffic_filter.is_allowed("www.should-block.net")
        assert not traffic_filter.is_allowed("www.not-allowed.net")

        assert not traffic_filter.is_allowed("www.google.c")
        assert not traffic_filter.is_allowed("wno.")
        assert not traffic_filter.is_allowed("127.0.0.1")

    async def test_traffic_filter_parser_with_invalid_ip_value_on_block_list(self):
        raw_allow_list = ""
        raw_block_list = "192.21,192.168.24.1"

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("www.google.com")
        assert not traffic_filter.is_allowed("google.com")

        assert not traffic_filter.is_allowed("192.125")
        assert not traffic_filter.is_allowed("124.4555")

        assert not traffic_filter.is_allowed("www.should-block.net")
        assert not traffic_filter.is_allowed("www.not-allowed.net")

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("wno.")

    async def test_traffic_filter_with_block_list(self):
        raw_allow_list = None
        raw_block_list = (
            "192.168.24.1,google.com,https://www.facebook.com,https://httbin.com"
        )

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("google.com")

        assert not traffic_filter.is_allowed("https://www.facebook.com")
        assert not traffic_filter.is_allowed("https://httbin.com")

    async def test_traffic_filter_with_allow_list(self):
        raw_allow_list = "192.168.24.1,google.com,www.facebook.com,httpbin.com, httpbin"
        raw_block_list = None

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert traffic_filter.is_allowed("192.168.24.1")
        assert traffic_filter.is_allowed("google.com")

        assert traffic_filter.is_allowed("www.facebook.com")
        assert traffic_filter.is_allowed("httpbin.com")
        assert not traffic_filter.is_allowed("httpbin")

    async def test_traffic_filter_with_same_host_on_both_lists(self):
        raw_allow_list = "google.com"
        raw_block_list = "google.com"

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert traffic_filter.is_allowed("google.com")

    async def test_traffic_filter_should_not_work_when_using_protocol(self):
        raw_allow_list = None
        raw_block_list = "https://google.com"

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("google.com")

    async def test_traffic_filter_should_not_work_when_using_path_param(self):
        raw_allow_list = None
        raw_block_list = "google.com/my_test/1"

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("google.com")

    async def test_traffic_filter_should_not_work_when_using_port(self):
        raw_allow_list = None
        raw_block_list = "google.com:443"

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("google.com")

    async def test_traffic_filter_should_not_allow_internal_address(
        self,
    ):
        raw_allow_list = None
        raw_block_list = None

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("127.0.0.1")
        assert not traffic_filter.is_allowed("10.0.0.138")
        assert not traffic_filter.is_allowed("172.16.25.1")
        assert traffic_filter.is_allowed("google.com")
        assert traffic_filter.is_allowed("www.httpbin.com")

    async def test_traffic_filter_validate_cach_dont_fail(
        self,
    ):
        raw_allow_list = None
        raw_block_list = None

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("127.0.0.1")
        assert not traffic_filter.is_allowed("10.0.0.138")
        assert not traffic_filter.is_allowed("172.16.25.1")
        assert traffic_filter.is_allowed("google.com")
        assert traffic_filter.is_allowed("www.httpbin.com")
        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("127.0.0.1")
        assert not traffic_filter.is_allowed("10.0.0.138")
        assert not traffic_filter.is_allowed("172.16.25.1")
        assert traffic_filter.is_allowed("google.com")
        assert traffic_filter.is_allowed("www.httpbin.com")
        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("127.0.0.1")
        assert not traffic_filter.is_allowed("10.0.0.138")
        assert not traffic_filter.is_allowed("172.16.25.1")
        assert traffic_filter.is_allowed("google.com")
        assert traffic_filter.is_allowed("www.httpbin.com")

    async def test_traffic_filter_should_allow_internal_address_if_set_in_allow_list(
        self,
    ):
        raw_allow_list = "192.168.24.1"
        raw_block_list = None

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("192.168.24.2")

    async def test_traffic_filter_should_block_unresolved_adresses(
        self,
    ):
        raw_allow_list = None
        raw_block_list = None

        traffic_filter = TrafficFilter(
            raw_allow_list=raw_allow_list, raw_block_list=raw_block_list, logger=_LOGGER
        )
        traffic_filter.managed = False

        assert not traffic_filter.is_allowed("192.168.24.1")
        assert not traffic_filter.is_allowed("192.168.24.2")
        assert not traffic_filter.is_allowed("www.not_working.lol")
