import logging
from re import compile, match
from typing import Dict, Optional, List
from socket import gethostbyname, error as socket_error
from ipaddress import ip_address, IPv4Address, IPv4Network

# This regex check test: https://regex101.com/r/Zt9EyZ/1
_NOT_ONLY_NUMBERS = compile(r"^[\d.]+$")
_RE_ADDRESS_VALIDATOR = compile(
    r"^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9]){2,}$"
)

# Consts
_LIST_DELIMITER = ","
_ALLOW_LIST = "AllowList"
_BLOCK_LIST = "BlockList"
_ALLOWED_HEADER_VALUE = "true"
_ALLOWED_HEADER_KEY = "x-lunar-allow"
_PRIVATE_IP_RANGES: Dict[str, IPv4Network] = {
    "10": IPv4Network("10.0.0.0/8"),
    "12": IPv4Network("127.0.0.0/8"),
    "17": IPv4Network("172.16.0.0/12"),
    "19": IPv4Network("192.168.0.0/16"),
}
_BLACK_HOLE = IPv4Network("0.0.0.0/32")


class TrafficFilter:
    """
    TrafficFilter Mechanism assists to filter the traffic forwarded through the Proxy.

    Args:
        raw_block_list (Optional[str]): The block list allow the user to avoid forwarding
                                                selected hosts or IPs through Lunar Proxy
        raw_allow_list (Optional[str]): The allow list allow the user to only forward
                                                selected hosts or IPs through Lunar Proxy
        logger (logging.Logger): Logger.
    """

    def __init__(
        self,
        raw_block_list: Optional[str],
        raw_allow_list: Optional[str],
        logger: logging.Logger,
    ):
        self._logger = logger
        self._managed = False
        self._is_external_cache: Dict[str, bool] = dict()
        self._block_list: Optional[List[str]] = self._parse_list(raw_block_list)
        self._allow_list: Optional[List[str]] = self._parse_list(raw_allow_list)
        self._state_ok = self.is_access_list_valid()
        self._logger.debug(
            f"TrafficFilter loaded, TrafficFilter validation passed successfully:\
                 {self._state_ok}"
        )

    def is_allowed(self, host_or_ip: str, headers: Optional[Dict[str, str]]) -> bool:
        """Check if the given HOST or IP should be forward through the Proxy

        Args:
            host_or_ip (str): The HOST or IP to check for.

        Returns:
            bool: True if the given HOST or IP should be forward through the Proxy.
        """
        if not self._state_ok:
            return False

        header_based_filter = self._check_for_header_based_filter(headers)
        if header_based_filter is not None:
            return header_based_filter

        return self._check_if_host_or_ip_is_allowed(host_or_ip=host_or_ip)

    @property
    def managed(self) -> bool:
        """Check if the Proxy is managed

        Returns:
            bool: True if Proxy is managed else False.
        """
        return self._managed

    @managed.setter
    def managed(self, managed: bool = False) -> None:
        """Update the status of whether the proxy is managed and validate the list after the update.

        Returns:
            None
        """
        self._logger.debug(f"Proxy is running in managed={managed} mode")
        self._managed = managed

    def _check_if_host_or_ip_is_allowed(self, host_or_ip: str) -> bool:
        """Check if the given HOST or IP should be forward through the Proxy

        Args:
            host_or_ip (str): The HOST or IP to check for.

        Returns:
            bool: True if the given HOST or IP should be forward through the Proxy.
        """
        is_allowed = self._check_allowed(host_or_ip=host_or_ip)
        if is_allowed is not None:
            return is_allowed

        return self._check_blocked(host_or_ip) and self._is_external(host_or_ip)

    def _check_allowed(self, host_or_ip: str) -> Optional[bool]:
        """Check if the given HOST or IP should be forward through the Proxy

        Args:
            host_or_ip (str): The HOST or IP to check for.

        Returns:
            bool: True if the given HOST or IP should be forward through the Proxy.
        """
        if self._allow_list is None:
            return None

        return host_or_ip in self._allow_list

    def _check_blocked(self, host_or_ip: str) -> bool:
        """Check if the given HOST or IP should not be forward through the Proxy

        Args:
            host_or_ip (str): The HOST or IP to check for.

        Returns:
            bool: True if the given HOST or IP should not be forward through the Proxy.
        """
        if not self._block_list:
            return True

        if host_or_ip in self._block_list:
            return False

        return True

    def _parse_list(self, value_to_parse: Optional[str]) -> Optional[List[str]]:
        """Parsed the given value_to_parse if needed.

        Args:
            value_to_parse (Optional[str]): A string to parse to a List of strings.

        Returns:
            Optional[List[str]]: If exists, returns a list of strings or None if empty.
        """
        if value_to_parse is None or not value_to_parse:
            return None

        return value_to_parse.split(_LIST_DELIMITER)

    def _check_for_header_based_filter(
        self, headers: Optional[Dict[str, str]]
    ) -> Optional[bool]:
        if not headers:
            return None

        is_allowed = headers.pop(_ALLOWED_HEADER_KEY, None)

        if is_allowed is None:
            return is_allowed

        return is_allowed == _ALLOWED_HEADER_VALUE

    def is_access_list_valid(self) -> bool:
        """Validates the destinations lists.

        Returns:
            bool: True if the validation flow passed successfully, False otherwise.
        """
        if not self._validate_allow():
            return False

        if not self._validate_block():
            self._logger.warning(
                "Interceptor will be disable to avoid \
                 passing wrong traffic through the Proxy."
            )
            return False

        return True

    def _validate_allow(self) -> bool:
        """Validate the allow list values

        Returns:
            bool: True if the validation passed,
                  in the allow list we dont failed on wrong values
                  and continue the flow.
        """
        if not self._allow_list:
            return True

        values_to_remove: List[str] = []

        for host in self._allow_list:
            if not (self._validate_host(host) or self._validate_ip(host)):
                values_to_remove.append(host)

        for value_to_remove in values_to_remove:
            self._logger.warning(
                f"Unsupported value '{value_to_remove}' will removed from the allowed list."
            )
            self._allow_list.remove(value_to_remove)

        return True

    def _validate_block(self):
        """Validate the block list values

        Returns:
            bool: True if the validation passed, False otherwise.
        """
        if not self._block_list:
            return True

        if self._allow_list:
            self._logger.warning(
                f"TrafficFilter::Found {_ALLOW_LIST} skipping the {_BLOCK_LIST}"
            )
            self._block_list = []
            return True

        block_list_validation_pass = True
        for host in self._block_list:
            if not (self._validate_host(host) or self._validate_ip(host)):
                self._logger.warning(
                    f"Error while parsing '{host}' from the block list"
                )
                block_list_validation_pass = False

        return block_list_validation_pass

    def _validate_host(self, host: str) -> bool:
        """Validate that the given host is valid.

        Args:
            host (str): The host to validate

        Returns:
            bool: True if the host is valid, False otherwise.
        """
        if match(_NOT_ONLY_NUMBERS, host) is not None:
            return False

        return match(_RE_ADDRESS_VALIDATOR, host) is not None

    def _is_external(self, host_or_ip: str) -> bool:
        """Check whether an HOST or IP is external or not

        Args:
            host_or_ip (str): The HOST or IP to check for.

        Returns:
            bool: True if the HOST or IP is external, False otherwise
        """
        is_external = self._is_external_cache.get(host_or_ip, None)

        if is_external is not None:
            return is_external

        if self._validate_ip(host_or_ip):
            is_external = self._is_external_ip(host_or_ip)

        else:
            is_external = self._is_external_domain(host_or_ip)

        if is_external is None:
            # For cases that we could not resolve the destination.
            # We do not store the result to try again on next iteration.
            return False

        self._is_external_cache[host_or_ip] = is_external
        return is_external

    def _validate_ip(self, ip: str) -> bool:
        """Validate that the given IP is a valid address

        Args:
            ip (str): The ip to validate

        Returns:
            bool: True if the IP is valid, False otherwise.
        """
        try:
            ip_address(ip)
            return True

        except:
            return False

    def _is_external_ip(self, ip: str) -> bool:
        """Check whether an IP is external or not

        Args:
            ip (str): The IP to check for.

        Returns:
            bool: True if the IP is external, False otherwise
        """
        return IPv4Address(ip) not in _PRIVATE_IP_RANGES.get(ip[:2], _BLACK_HOLE)

    def _is_external_domain(self, host: str) -> Optional[bool]:
        """Check whether an HOST is external or not

        Args:
            host (str): The HOST to check for.

        Returns:
            bool: True if the HOST is external, False otherwise
        """
        try:
            return self._is_external_ip(gethostbyname(host))

        except socket_error as error:
            # If there is a network error, we will avoid storing this and will try again next time.
            self._logger.warning(
                f"TrafficFilter::Could not resolve: '{host}'. Error: {error}"
            )
            return None
