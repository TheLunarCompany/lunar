from os import getenv

from github import Auth
from github import Requester
from github import Github as GitHubSDK
from requests import Response
from sdks import SDK


_REPO_NAME = "TheLunarCompany/lunar-private"
_ORIGINAL_REQUESTS_RESPONSE = Requester.RequestsResponse

class LunarRequesterHook(_ORIGINAL_REQUESTS_RESPONSE):
    def __init__(self, r: Response):
        if "x-lunar-sequence-id" in r.raw.headers:
            r.headers["x-lunar-sequence-id"] = r.raw.headers["x-lunar-sequence-id"]
        super().__init__(r)

Requester.RequestsResponse = LunarRequesterHook

class Github(SDK):
	def __init__(self):
		auth = Auth.Token(getenv("GH_TEST_TOKEN", ""))
		self._git = GitHubSDK(auth=auth)
		super().__init__()
  
	def test(self) -> bool:
		repo = self._git.get_repo(_REPO_NAME)
		return self._valid_headers(repo.raw_headers)  # type: ignore	

	def test_stream(self) -> bool:
		print("Test not available for this SDK")
		return True

	async def test_async(self) -> bool:
		print("Test not available for this SDK")
		return True

	async def test_stream_async(self) -> bool:
		print("Test not available for this SDK")
		return True


def load_sdk() ->	Github:
	return Github()