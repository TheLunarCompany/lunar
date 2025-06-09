import os
import logging
from mitmproxy import http

APP_NAME = "mcpx-interceptor"
LUNAR_HOST = os.environ.get("LUNAR_HOST")
LUNAR_PORT = int(os.environ.get("LUNAR_PORT", 443))
LUNAR_SCHEME = os.environ.get("LUNAR_SCHEME", "https")
LUNAR_API_KEY = os.environ.get("API_KEY", "")
MCPX_LOG_LEVEL = os.environ.get("LOG_LEVEL", "ERROR").upper()


def _initialize_lunar_logger() -> logging.Logger:
    log_format = logging.Formatter(f"[{APP_NAME}] %(asctime)s - %(levelname)s: %(message)s")
    logger = logging.getLogger(name=APP_NAME)
    logger.setLevel(MCPX_LOG_LEVEL)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(MCPX_LOG_LEVEL)
    stream_handler.setFormatter(log_format)
    logger.addHandler(stream_handler)

    return logger


logger = _initialize_lunar_logger()
logger.info(f"Initialized with LUNAR_HOST={LUNAR_HOST}, LUNAR_PORT={LUNAR_PORT}, LUNAR_SCHEME={LUNAR_SCHEME}, MCPX_LOG_LEVEL={MCPX_LOG_LEVEL}")

class LunarRedirectorToHttps:
  def request(self, flow: http.HTTPFlow) -> None:
      logger.debug(f"Intercepting request to: {flow.request.pretty_url}")
      host_name = flow.request.pretty_host.replace("https://", "").replace("http://", "").split("/")[0]
          
      flow.request.headers["Host"] = LUNAR_HOST
      flow.request.headers["x-lunar-host"] = host_name
      flow.request.headers["x-lunar-scheme"] = flow.request.scheme
      flow.request.headers["x-lunar-api-key"] = LUNAR_API_KEY

      flow.request.scheme = LUNAR_SCHEME
      flow.request.host = LUNAR_HOST
      flow.request.port = LUNAR_PORT


addons = [
    LunarRedirectorToHttps(),
]
