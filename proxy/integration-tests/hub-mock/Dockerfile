FROM python:3.10

WORKDIR /
RUN pip install --no-cache-dir tornado

COPY ./hub-mock ./hub-mock

ENTRYPOINT ["python", "hub-mock/hub.py"]