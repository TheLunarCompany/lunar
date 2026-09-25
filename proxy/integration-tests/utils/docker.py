from os.path import abspath, dirname

from toolkit_testing.integration_tests.docker import (
    start_service_builder,
    stop_service_builder,
    rm_service_builder,
    build_service_builder,
    down_services_builder,
)

_dir = f"{abspath(dirname(dirname(__file__)))}"
_filename = "docker-compose.yml"

start_service = start_service_builder(_dir, _filename)
stop_service = stop_service_builder(_dir, _filename)
build_service = build_service_builder(_dir, _filename)
down_services = down_services_builder(_dir, _filename)
rm_service = rm_service_builder(_dir, _filename)
