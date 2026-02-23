import { RequestHandler } from "express";
import ipaddr from "ipaddr.js";
import { Logger } from "winston";
import { loggableError } from "../logging/index.js";

type Bits = number; // 0-32 for IPv4, 0-128 for IPv6
export type CompiledRange = [ipaddr.IPv4 | ipaddr.IPv6, Bits];

function compileOne(rawIP: string): CompiledRange {
  const s = rawIP.trim();
  const hasSlash = s.includes("/");
  const [ipStr, prefixStr] = hasSlash ? s.split("/", 2) : [s, ""];
  if (!ipStr) throw new Error(`Invalid IP in range: ${s}`);
  if (!ipaddr.isValid(ipStr)) throw new Error(`Invalid IP in range: ${s}`);

  let addr = ipaddr.parse(ipStr);
  if (isIPv6(addr) && addr.isIPv4MappedAddress()) {
    addr = addr.toIPv4Address();
  }

  const max = isIPv6(addr) ? 128 : 32;
  const prefix = hasSlash ? Number(prefixStr) : max;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) {
    throw new Error(`Invalid prefix in range: ${s}`);
  }
  return [addr, prefix];
}

export function compileRanges(ranges: string[]): CompiledRange[] {
  return ranges.map(compileOne);
}

function isIPv6(addr: ipaddr.IPv4 | ipaddr.IPv6): addr is ipaddr.IPv6 {
  return addr.kind() === "ipv6";
}

export function ipAllowed(ip: string, compiled: CompiledRange[]): boolean {
  const addr = ipaddr.parse(ip);
  const norm =
    isIPv6(addr) && addr.isIPv4MappedAddress() ? addr.toIPv4Address() : addr;

  return compiled.some(([base, bits]) => {
    if (norm.kind() !== base.kind()) return false;
    return norm.match([base, bits]);
  });
}

export function makeIpAllowlistMiddleware(
  compiled: CompiledRange[] | undefined,
  logger: Logger,
): RequestHandler {
  return (req, res, next) => {
    // If compiled is undefined, feature is disabled - allow all
    if (compiled === undefined) {
      return next();
    }

    const ip = req.ip;
    try {
      if (!ip) return res.status(400).send("Unable to determine client IP");

      // If compiled is empty array, block all IPs
      if (compiled.length === 0) {
        logger.debug("Blocking request - no IPs allowed", { ip });
        return res.status(403).send("Forbidden: No IPs allowed");
      }

      const isAllowed = ipAllowed(ip, compiled);
      if (!isAllowed) {
        logger.debug("Blocking request from disallowed IP", { ip });
        return res.status(403).send("Forbidden: IP not allowed");
      }
      return next();
    } catch (e) {
      logger.error("Error in IP allowlist middleware", {
        error: loggableError(e),
        ip,
      });
      return res.status(400).send("Unable to determine client IP");
    }
  };
}
