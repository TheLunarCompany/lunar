import logging
import pkg_resources
from os import getenv
from typing import Callable, TypeVar

# Const
_T = TypeVar("_T")


def load_env_value(
    key: str,
    cast_to: Callable[[str], _T],
    default_value: _T,
    logger: logging.Logger = logging.getLogger(),
) -> _T:
    """Loads and prepare the values from the env variables, and cast in a type-safe manner.

    Args:
        key (str): The ENV value to get the value from.
        cast_to (_T): The type to cast the ENV value to.
        default_value (_T): Fallback value in case an error occurs.

    Returns:
        _T: The cast value or the default value passed to the function.
    """
    extracted_value = getenv(key, None)

    if extracted_value is None:
        logger.debug(
            f"Could not find value of: {key}.Will set {default_value} as default"
        )
        return default_value

    try:
        return cast_to(extracted_value)

    except ValueError as error:
        logger.warning(
            f"Could not convert the value of: {key} to: {type(cast_to)}, \
                Error: {error} Will set {default_value} as default"
        )

    return default_value


def get_package_version(package_name: str) -> str:
    try:
        return pkg_resources.get_distribution(package_name).version
    except Exception:
        return "unknown"
