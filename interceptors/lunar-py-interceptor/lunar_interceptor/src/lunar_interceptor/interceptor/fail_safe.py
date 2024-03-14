import logging
from time import time

from types import TracebackType
from typing import Optional, Tuple, Type, Any, Mapping
import traceback as tb

# Default values
_DEFAULT_MAX_ERROR_ALLOWED = 5
_DEFAULT_FAILSAFE_COOLDOWN_SEC = 10

_HEADER_ERROR_KEY = "x-lunar-error"


class ProxyErrorException(Exception):
    pass


class FailSafe:
    """
    FailSafe Mechanism assists with creating a dynamic circuit breaker,
    preventing unnecessary delays and ensuring that the system runs smoothly.

    Args:
        cooldown_time (Optional[int]): the time of cooldown on max error exceeded.
        max_errors_allowed (Optional[int]): the amount of error to allow
                                            before enter to cooldown.
        logger (logging.Logger): Logger.
        count_on_exceptions (Tuple[Type[BaseException], ...]):
            The types of exception to catch, and not return to the user.
    """

    def __init__(
        self,
        cooldown_time: Optional[int],
        max_errors_allowed: Optional[int],
        logger: logging.Logger,
        handle_on: Tuple[Type[BaseException], ...] = (),
    ) -> None:
        self._logger = logger
        self._state_ok = True

        self._error_counter = 0
        self._cooldown_started_at = 0
        self._handle_on: Tuple[Type[BaseException], ...] = handle_on

        self._max_errors_allowed: int = cooldown_time or _DEFAULT_MAX_ERROR_ALLOWED
        self._cooldown_time: int = max_errors_allowed or _DEFAULT_FAILSAFE_COOLDOWN_SEC

    def __enter__(self) -> "FailSafe":
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_value: Any,
        traceback: TracebackType,
    ) -> bool:
        if exc_type is not None and issubclass(exc_type, self._handle_on):
            self._on_error()
            self._logger.warning(
                f"FailSafe::Error communicating with Lunar Proxy, Error: {exc_value}"
            )
            self._logger.debug(
                f"Exception: {str(exc_type)}, Traceback: {tb.format_tb(traceback)}"
            )
            return True  # Handle the exception for the caller

        elif exc_type is not None:
            return False  # Dont handle the exception for the caller

        self._error_counter = 0
        return True

    @property
    def state_ok(self) -> bool:
        """Get indication about the current FailSafe state.

        Returns:
            bool: True if the flow runs as expected,
                  False if circuit should be broken.
        """
        self._ensure_exit_fail_safe()
        return self._state_ok

    def handle_on(self, handle_on: Tuple[Type[BaseException], ...]):
        """Sets the type of exception the failsafe should handle

        Args:
            handle_on (Tuple[Type[BaseException], ...]): The exception types to handle
        """
        self._handle_on = self._handle_on + handle_on

    def validate_headers(self, headers: Mapping[str, str]):
        """Validates the response headers and if the error header exists then raises an Exception.

        Args:
            headers (Mapping[str, str]): The response headers to check if the error header exists

        Raises:
            ProxyErrorException: if the error header exists.
        """
        if _HEADER_ERROR_KEY not in headers:
            return

        raise ProxyErrorException("An error occurs on the Proxy side")

    def _on_error(self):
        """
        Increase the counter and break the circuit if needed.
        """
        self._error_counter += 1
        self._ensure_enter_fail_safe()

    def _ensure_enter_fail_safe(self):
        """
        Ensure that the circuit breaks if needed.
        """
        if self._max_errors_allowed > self._error_counter:
            return

        self._state_ok = False
        self._cooldown_started_at = time()

    def _ensure_exit_fail_safe(self):
        """
        Ensure that the circuit is restored to the original flow if needed.
        """
        if (
            not self._state_ok
            and (time() - self._cooldown_started_at) >= self._cooldown_time
        ):
            self._state_ok = True
