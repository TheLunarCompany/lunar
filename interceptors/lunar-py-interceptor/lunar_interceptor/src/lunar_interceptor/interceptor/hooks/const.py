from lunar_interceptor.interceptor.helpers import get_package_version

HTTP_SCHEME = "http"
HTTPS_SCHEME = "https"
X_LUNAR_HOST_HEADER_KEY = "x-lunar-host"
X_LUNAR_SCHEME_HEADER_KEY = "x-lunar-scheme"
X_LUNAR_INTERCEPTOR_HEADER_KEY = "x-lunar-interceptor"
X_LUNAR_TENANT_ID_HEADER_KEY = "x-lunar-tenant-id"
INTERCEPTOR_TYPE_VALUE = "lunar-py-interceptor"
VERSION = get_package_version("lunar-interceptor")
INTERCEPTOR_HEADER_DELIMITER = "/"
LUNAR_INTERCEPTOR_HEADER_VALUE = (
    f"{INTERCEPTOR_TYPE_VALUE}{INTERCEPTOR_HEADER_DELIMITER}{VERSION}"
)

HEADERS_KWARGS_KEY = "headers"
CACHE_HEADERS_KEY = "headers"
LUNAR_SEQ_ID_HEADER_KEY = "x-lunar-sequence-id"
LUNAR_RETRY_AFTER_HEADER_KEY = "x-lunar-retry-after"
