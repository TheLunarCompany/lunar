ARG PYTHON_VERSION
FROM python:${PYTHON_VERSION}

ARG MODULE_VERSION
ARG CLIENT_TYPE "aiohttp"
ENV CLIENT=$CLIENT_TYPE

WORKDIR /
COPY ./lunar_interceptor ./lunar_interceptor
RUN pip install --no-cache-dir ./lunar_interceptor  && pip install --no-cache-dir tornado && pip install --no-cache-dir ${CLIENT_TYPE}==${MODULE_VERSION}

COPY ./test-client ./test-client

ENTRYPOINT ["sh", "-c", "python -u test-client/${CLIENT}_client.py"]