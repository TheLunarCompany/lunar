import sys
from os import getenv

from flask import Flask, make_response, request


from tornado.httpclient import HTTPClient

import lunar_interceptor  # type: ignore [reportUnusedImport]

_HTTPBINMOCK_BASE_URL = "http://httpbinmock"
app = Flask(__name__)


@app.route("/trigger", methods=["GET"])
def trigger():
    http_client = HTTPClient()
    resp = http_client.fetch(
        f"{_HTTPBINMOCK_BASE_URL}/uuid", headers=request.headers
    )
    response = make_response(resp.body, resp.code)
    for key, value in resp.headers.get_all():
        response.headers[key] = value

    return response


@app.route("/trigger_post", methods=["POST"])
def trigger_post():
    http_client = HTTPClient()
    resp = http_client.fetch(
        f"{_HTTPBINMOCK_BASE_URL}/post", method="POST", body=request.data
    )
    response = make_response(resp.body, resp.code)
    for key, value in resp.headers.get_all():
        response.headers[key] = value

    return response


@app.route("/trigger_headers", methods=["GET"])
def trigger_headers():
    http_client = HTTPClient()
    resp = http_client.fetch(
        f"{_HTTPBINMOCK_BASE_URL}/headers", headers=request.headers
    )
    response = make_response(resp.body, resp.code)
    for key, value in resp.headers.get_all():
        response.headers[key] = value

    return response


@app.route("/trigger_bad_url", methods=["GET"])
def trigger_bad_url():
    http_client = HTTPClient()
    resp = http_client.fetch(f"{_HTTPBINMOCK_BASE_URL}/anything/bad_url")
    
    response = make_response(resp.body, resp.code)
    for key, value in resp.headers.get_all():
        response.headers[key] = value

    return response


@app.route("/trigger_local", methods=["GET"])
def trigger_local():
    http_client = HTTPClient()
    resp = http_client.fetch(
        f"{_HTTPBINMOCK_BASE_URL}/uuid", headers=request.headers
    )
    response = make_response(resp.body, resp.code)
    for key, value in resp.headers.get_all():
        response.headers[key] = value

    return response


@app.route("/trigger_dynamic/<method>/<url>", methods=["GET"])
def trigger_dynamic(method: str, url: str):
    http_client = HTTPClient()
    resp = http_client.fetch(url, method=method.upper())

    response = make_response(resp.body, resp.code)
    for key, value in resp.headers.get_all():
        response.headers[key] = value

    return response


@app.route("/trigger_retry", methods=["GET"])
def trigger_retry():
    http_client = HTTPClient()
    resp = http_client.fetch(f"{_HTTPBINMOCK_BASE_URL}/anything/retry/attempt")

    response = make_response(resp.body, resp.code)
    for key, value in resp.headers.get_all():
        response.headers[key] = value

    return response


@app.route("/healthcheck", methods=["GET"])
def healthcheck():
    response = make_response({"status": "OK"}, 200)
    response.headers['Content-Type'] = 'application/json' 
    return response


if __name__ == "__main__":
    host = getenv("LUNAR_PROXY_HOST", "")
    print(f"Client is up. Python version: {sys.version}. Proxy is at {host}")
    app.run(host="0.0.0.0", port=8080)
