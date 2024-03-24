from os.path import abspath, dirname
from toolkit_testing.integration_tests.docker import (
    build_service_builder,
    start_service_builder,
    stop_service_builder,
)

docker_compose_dir = f"{abspath(dirname(__file__))}/.."
docker_compose_filename = "docker-compose.yml"
build_service = build_service_builder(docker_compose_dir, docker_compose_filename)
start_service = start_service_builder(docker_compose_dir, docker_compose_filename)
stop_service = stop_service_builder(docker_compose_dir, docker_compose_filename)
