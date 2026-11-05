FROM python:3.15.2

WORKDIR /
RUN pip install --no-cache-dir tornado

COPY ./hub-mock ./hub-mock

ENTRYPOINT ["python", "hub-mock/hub.py"]