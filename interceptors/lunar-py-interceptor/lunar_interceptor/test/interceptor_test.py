import pytest


@pytest.mark.asyncio
class TestInterceptorComponent:
    async def test_interceptor(self):
        import aiohttp
        import lunar_interceptor  # type: ignore [reportUnusedImport]

        async with aiohttp.ClientSession() as sess:
            async with sess.get("https://httpbin.org/get") as resp:
                assert resp.status == 200

    async def test_interceptor_with_none_as_headers(self):
        import aiohttp
        import lunar_interceptor  # type: ignore [reportUnusedImport]

        async with aiohttp.ClientSession() as sess:
            async with sess.get("https://httpbin.org/get", headers=None) as resp:
                assert resp.status == 200
