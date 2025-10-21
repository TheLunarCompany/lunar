# IP Access Control

This module provides IP-based access control middleware for Express applications, supporting both IPv4 and IPv6 addresses with CIDR notation for defining IP ranges.

## Overview

The IP access control feature allows you to restrict access to your application by defining an allowlist of IP addresses or ranges. When enabled, only requests from IPs matching the configured ranges will be allowed through.

## Configuration Examples

### Disable IP Filtering (Allow All)
To disable IP filtering and allow all incoming connections, pass `undefined` to the middleware:
```javascript
const middleware = makeIpAllowlistMiddleware(undefined, logger);
```

### Block All IPs
To block all incoming connections, pass an empty array:
```javascript
const ranges = compileRanges([]);
const middleware = makeIpAllowlistMiddleware(ranges, logger);
```

### Allow a Single IP Address

#### IPv4
```javascript
const ranges = compileRanges(["192.168.1.100"]);
```

#### IPv6
```javascript
const ranges = compileRanges(["2001:db8::1"]);
```

### Allow Localhost

#### IPv4 Localhost
```javascript
const ranges = compileRanges(["127.0.0.1"]);
```

#### IPv6 Localhost
```javascript
const ranges = compileRanges(["::1"]);
```

#### Both IPv4 and IPv6 Localhost
```javascript
const ranges = compileRanges(["127.0.0.1", "::1"]);
```

### Allow IP Ranges with CIDR Notation

#### IPv4 Range (e.g., 192.168.1.0-192.168.1.255)
```javascript
const ranges = compileRanges(["192.168.1.0/24"]);
```

#### IPv6 Range
```javascript
const ranges = compileRanges(["2001:db8::/32"]);
```

### Multiple IP Ranges
```javascript
const ranges = compileRanges([
  "10.0.0.0/8",        // Private network (10.0.0.0 - 10.255.255.255)
  "172.16.0.0/12",     // Private network (172.16.0.0 - 172.31.255.255)
  "192.168.0.0/16",    // Private network (192.168.0.0 - 192.168.255.255)
  "127.0.0.1",         // IPv4 localhost
  "::1",               // IPv6 localhost
  "2001:db8::/32"      // IPv6 documentation range
]);
```

### Common Private Network Ranges
```javascript
const ranges = compileRanges([
  "10.0.0.0/8",        // Class A private network
  "172.16.0.0/12",     // Class B private network
  "192.168.0.0/16",    // Class C private network
  "127.0.0.0/8"        // Loopback range
]);
```

## CIDR Notation

CIDR (Classless Inter-Domain Routing) notation is a method for specifying IP address ranges using a base IP address followed by a slash and the number of significant bits in the network prefix.

- **IPv4 Example**: `192.168.1.0/24` represents all IPs from 192.168.1.0 to 192.168.1.255 (256 addresses)
- **IPv6 Example**: `2001:db8::/32` represents all IPs starting with 2001:db8:

The number after the slash indicates how many bits from the start of the IP address are fixed:
- `/32` in IPv4 = single IP address
- `/24` in IPv4 = 256 addresses (last octet varies)
- `/16` in IPv4 = 65,536 addresses (last two octets vary)
- `/128` in IPv6 = single IP address
- `/64` in IPv6 = standard subnet size

For more information about CIDR notation, see the [RFC 4632 specification](https://datatracker.ietf.org/doc/html/rfc4632).

## Usage

```javascript
import { compileRanges, makeIpAllowlistMiddleware } from "@toolkit-core/ip-access";
import express from "express";
import winston from "winston";

const app = express();
const logger = winston.createLogger(/* your config */);

// Configure allowed IP ranges
const allowedRanges = [
  "192.168.1.0/24",
  "10.0.0.0/8",
  "::1"
];

// Compile the ranges (validates and prepares for efficient matching)
const compiled = compileRanges(allowedRanges);

// Create and apply the middleware
const ipAllowlistMiddleware = makeIpAllowlistMiddleware(compiled, logger);
app.use(ipAllowlistMiddleware);
```

## Notes

- IPv4-mapped IPv6 addresses (e.g., `::ffff:192.168.1.1`) are automatically normalized to their IPv4 equivalents for matching
- Invalid IP addresses or CIDR ranges will throw an error during compilation
- The middleware returns HTTP 403 Forbidden for blocked IPs
- When IP filtering is disabled (`undefined`), all requests are allowed through
- When an empty array is provided, all requests are blocked