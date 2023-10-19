ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}

ARG AIOHTTP_VERSION
RUN echo ${AIOHTTP_VERSION}

WORKDIR /
COPY ./lunar_interceptor ./lunar_interceptor
RUN pip install --no-cache-dir ./lunar_interceptor && pip install --no-cache-dir aiohttp==${AIOHTTP_VERSION}

COPY ./test-client ./test-client

ENTRYPOINT [ "python", "-u", "test-client/client.py" ]
