ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}

ARG MODULE_VERSION
ARG CLIENT_TYPE "aiohttp"
ARG MODULE_PIP_NAME=${CLIENT_TYPE}
ENV CLIENT=$CLIENT_TYPE

WORKDIR /
COPY ./lunar_interceptor ./lunar_interceptor
RUN pip install --no-cache-dir ./lunar_interceptor && pip install --no-cache-dir flask && pip install --upgrade --no-cache-dir ${MODULE_PIP_NAME}==${MODULE_VERSION}

RUN set -ex \
    && if ! pip show tornado >/dev/null 2>&1; then pip install --no-cache-dir tornado; fi

COPY ./test-client ./test-client

ENTRYPOINT ["sh", "-c", "python -u test-client/${CLIENT}_client.py"]