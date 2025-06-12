import os
import logging
from typing import Union
from dataclasses import dataclass
from urllib.parse import urlparse, ParseResult, ParseResultBytes

from mitmproxy import http


APP_NAME = "mcpx-interceptor"

@dataclass
class LunarConfig:
    host: str
    port: int
    scheme: str
    log_level: str
    lunar_api_key: str
    
    def __init__(self):
        self.lunar_api_key = os.environ.get("LUNAR_API_KEY", "")
        self.log_level = os.environ.get("LOG_LEVEL", "ERROR").upper()
        url = urlparse(os.environ.get("LUNAR_GATEWAY_URL", ""))

        if not url.port:
            self.port = 443 if url.scheme == "https" else 80
        else:
            self.port = url.port

        self.host = str(url.hostname)
        self.scheme = str(url.scheme)


lunar_config = LunarConfig()


def _initialize_lunar_logger() -> logging.Logger:
    log_format = logging.Formatter(f"[{APP_NAME}] %(asctime)s - %(levelname)s: %(message)s")
    logger = logging.getLogger(name=APP_NAME)
    logger.setLevel(lunar_config.log_level)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(lunar_config.log_level)
    stream_handler.setFormatter(log_format)
    logger.addHandler(stream_handler)

    return logger


logger = _initialize_lunar_logger()
logger.info(
    f"Initialized with LUNAR_HOST={lunar_config.host}, LUNAR_PORT={lunar_config.port}, "
    f"LUNAR_SCHEME={lunar_config.scheme}, MCPX_LOG_LEVEL={lunar_config.log_level}")

class LunarRedirectorToHttps:
  def request(self, flow: http.HTTPFlow) -> None:
      logger.debug(f"Intercepting request to: {flow.request.pretty_url}")
      host_name = flow.request.pretty_host.replace("https://", "").replace("http://", "").split("/")[0]

      flow.request.headers["Host"] = lunar_config.host
      flow.request.headers["x-lunar-host"] = host_name
      flow.request.headers["x-lunar-scheme"] = flow.request.scheme
      flow.request.headers["x-lunar-api-key"] = lunar_config.lunar_api_key

      flow.request.scheme = lunar_config.scheme
      flow.request.host = lunar_config.host
      flow.request.port = lunar_config.port


addons = [
    LunarRedirectorToHttps(),
]
