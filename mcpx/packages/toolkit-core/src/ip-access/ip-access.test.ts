import {
  compileRanges,
  ipAllowed,
  makeIpAllowlistMiddleware,
} from "./ip-access.js";
import { Request, Response } from "express";
import { noOpLogger } from "../logging/index.js";

describe(".isAllowed", () => {
  describe("IPv4 addresses", () => {
    it("should allow exact match IPv4 addresses", () => {
      const ranges = ["192.168.1.1"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.1", compiled)).toBe(true);
      expect(ipAllowed("192.168.1.2", compiled)).toBe(false);
      expect(ipAllowed("10.0.0.1", compiled)).toBe(false);
    });

    it("should handle IPv4 CIDR ranges", () => {
      const ranges = ["192.168.1.0/24"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.0", compiled)).toBe(true);
      expect(ipAllowed("192.168.1.1", compiled)).toBe(true);
      expect(ipAllowed("192.168.1.255", compiled)).toBe(true);
      expect(ipAllowed("192.168.2.1", compiled)).toBe(false);
      expect(ipAllowed("10.0.0.1", compiled)).toBe(false);
    });

    it("should handle multiple IPv4 ranges", () => {
      const ranges = ["192.168.1.0/24", "10.0.0.0/8"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.100", compiled)).toBe(true);
      expect(ipAllowed("10.0.0.1", compiled)).toBe(true);
      expect(ipAllowed("10.255.255.255", compiled)).toBe(true);
      expect(ipAllowed("11.0.0.0", compiled)).toBe(false);
      expect(ipAllowed("172.16.0.1", compiled)).toBe(false);
    });

    it("should handle localhost IPv4", () => {
      const ranges = ["127.0.0.1"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("127.0.0.1", compiled)).toBe(true);
      expect(ipAllowed("127.0.0.2", compiled)).toBe(false);
    });

    it("should handle localhost IPv4 with /32 (same as without suffix)", () => {
      const ranges = ["127.0.0.1/32"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("127.0.0.1", compiled)).toBe(true);
      expect(ipAllowed("127.0.0.2", compiled)).toBe(false);
      expect(ipAllowed("127.0.0.0", compiled)).toBe(false);
    });

    it("should handle localhost IPv4 range", () => {
      const ranges = ["127.0.0.0/8"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("127.0.0.1", compiled)).toBe(true);
      expect(ipAllowed("127.0.0.2", compiled)).toBe(true);
      expect(ipAllowed("127.255.255.255", compiled)).toBe(true);
      expect(ipAllowed("128.0.0.0", compiled)).toBe(false);
    });
  });

  describe("IPv6 addresses", () => {
    it("should allow exact match IPv6 addresses", () => {
      const ranges = ["2001:db8::1"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("2001:db8::1", compiled)).toBe(true);
      expect(ipAllowed("2001:db8::2", compiled)).toBe(false);
      expect(ipAllowed("2001:db9::1", compiled)).toBe(false);
    });

    it("should handle IPv6 CIDR ranges", () => {
      const ranges = ["2001:db8::/32"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("2001:db8::1", compiled)).toBe(true);
      expect(
        ipAllowed("2001:db8:ffff:ffff:ffff:ffff:ffff:ffff", compiled),
      ).toBe(true);
      expect(ipAllowed("2001:db9::1", compiled)).toBe(false);
      expect(ipAllowed("2002:db8::1", compiled)).toBe(false);
    });

    it("should handle localhost IPv6", () => {
      const ranges = ["::1"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("::1", compiled)).toBe(true);
      expect(ipAllowed("::2", compiled)).toBe(false);
      expect(ipAllowed("2001:db8::1", compiled)).toBe(false);
    });

    it("should handle IPv6 loopback range", () => {
      const ranges = ["::1/128"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("::1", compiled)).toBe(true);
      expect(ipAllowed("::2", compiled)).toBe(false);
    });
  });

  describe("IPv4-mapped IPv6 addresses", () => {
    it("should handle IPv4-mapped IPv6 addresses correctly", () => {
      const ranges = ["192.168.1.0/24"];
      const compiled = compileRanges(ranges);

      // IPv4-mapped IPv6 address for 192.168.1.1
      expect(ipAllowed("::ffff:192.168.1.1", compiled)).toBe(true);
      expect(ipAllowed("::ffff:192.168.1.100", compiled)).toBe(true);
      expect(ipAllowed("::ffff:192.168.2.1", compiled)).toBe(false);
    });

    it("should handle IPv4-mapped ranges correctly", () => {
      // When we compile an IPv4-mapped IPv6 address, it gets normalized to IPv4
      const ranges = ["::ffff:192.168.1.1"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.1", compiled)).toBe(true);
      expect(ipAllowed("::ffff:192.168.1.1", compiled)).toBe(true);
      expect(ipAllowed("192.168.1.2", compiled)).toBe(false);
    });

    it("should handle IPv4-mapped range with CIDR notation", () => {
      // This tests if IPv4-mapped with CIDR works correctly
      // The address normalizes to IPv4, so /24 should be valid
      const ranges = ["::ffff:192.168.1.0/24"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.1", compiled)).toBe(true);
      expect(ipAllowed("192.168.1.255", compiled)).toBe(true);
      expect(ipAllowed("::ffff:192.168.1.100", compiled)).toBe(true);
      expect(ipAllowed("192.168.2.1", compiled)).toBe(false);
    });
  });

  describe("mixed IPv4 and IPv6", () => {
    it("should handle mixed IPv4 and IPv6 ranges", () => {
      const ranges = ["192.168.1.0/24", "2001:db8::/32"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.100", compiled)).toBe(true);
      expect(ipAllowed("2001:db8::1", compiled)).toBe(true);
      expect(ipAllowed("10.0.0.1", compiled)).toBe(false);
      expect(ipAllowed("2002:db8::1", compiled)).toBe(false);
    });

    it("should not allow IPv6 address when only IPv4 ranges are configured", () => {
      const ranges = ["192.168.1.0/24"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("2001:db8::1", compiled)).toBe(false);
    });

    it("should not allow IPv4 address when only IPv6 ranges are configured", () => {
      const ranges = ["2001:db8::/32"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.1", compiled)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty compiled ranges", () => {
      const compiled = compileRanges([]);

      expect(ipAllowed("192.168.1.1", compiled)).toBe(false);
      expect(ipAllowed("::1", compiled)).toBe(false);
    });

    it("should handle /32 IPv4 CIDR (single address)", () => {
      const ranges = ["192.168.1.1/32"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.1", compiled)).toBe(true);
      expect(ipAllowed("192.168.1.0", compiled)).toBe(false);
      expect(ipAllowed("192.168.1.2", compiled)).toBe(false);
    });

    it("should handle /128 IPv6 CIDR (single address)", () => {
      const ranges = ["2001:db8::1/128"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("2001:db8::1", compiled)).toBe(true);
      expect(ipAllowed("2001:db8::2", compiled)).toBe(false);
    });

    it("should handle 0.0.0.0 as a single address", () => {
      const ranges = ["0.0.0.0"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("0.0.0.0", compiled)).toBe(true);
      expect(ipAllowed("0.0.0.1", compiled)).toBe(false);
      expect(ipAllowed("192.168.1.1", compiled)).toBe(false);
    });

    it("should handle /0 CIDR (match all)", () => {
      const ranges = ["0.0.0.0/0"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("192.168.1.1", compiled)).toBe(true);
      expect(ipAllowed("10.0.0.1", compiled)).toBe(true);
      expect(ipAllowed("8.8.8.8", compiled)).toBe(true);
      // IPv6 addresses won't match IPv4 /0
      expect(ipAllowed("2001:db8::1", compiled)).toBe(false);
    });

    it("should handle IPv6 ::/0 (match all IPv6)", () => {
      const ranges = ["::/0"];
      const compiled = compileRanges(ranges);

      expect(ipAllowed("2001:db8::1", compiled)).toBe(true);
      expect(ipAllowed("::1", compiled)).toBe(true);
      expect(ipAllowed("fe80::1", compiled)).toBe(true);
      // IPv4 addresses won't match IPv6 ::/0
      expect(ipAllowed("192.168.1.1", compiled)).toBe(false);
    });
  });

  describe("private network ranges", () => {
    it("should handle common private IPv4 ranges", () => {
      const ranges = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];
      const compiled = compileRanges(ranges);

      // 10.0.0.0/8
      expect(ipAllowed("10.0.0.1", compiled)).toBe(true);
      expect(ipAllowed("10.255.255.255", compiled)).toBe(true);

      // 172.16.0.0/12
      expect(ipAllowed("172.16.0.1", compiled)).toBe(true);
      expect(ipAllowed("172.31.255.255", compiled)).toBe(true);
      expect(ipAllowed("172.32.0.0", compiled)).toBe(false);

      // 192.168.0.0/16
      expect(ipAllowed("192.168.0.1", compiled)).toBe(true);
      expect(ipAllowed("192.168.255.255", compiled)).toBe(true);

      // Public IPs should not match
      expect(ipAllowed("8.8.8.8", compiled)).toBe(false);
      expect(ipAllowed("1.1.1.1", compiled)).toBe(false);
    });
  });
});

describe(".makeIpAllowlistMiddleware", () => {
  // Create test doubles without Jest mocks
  const createMockResponse = () => {
    let statusCode: number | undefined;
    let sentData: string | undefined;

    return {
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(data: string) {
        sentData = data;
        return this;
      },
      getStatus: () => statusCode,
      getSentData: () => sentData,
    } as Response & {
      getStatus: () => number | undefined;
      getSentData: () => string | undefined;
    };
  };

  const createMockRequest = (ip?: string) => {
    return { ip } as Request;
  };

  const createNextFunction = () => {
    let called = false;
    return {
      next: () => {
        called = true;
      },
      wasCalled: () => called,
    };
  };

  it("should call next() when IP is in allowlist", () => {
    const compiled = compileRanges(["192.168.1.0/24"]);
    const middleware = makeIpAllowlistMiddleware(compiled, noOpLogger);

    const req = createMockRequest("192.168.1.1");
    const res = createMockResponse();
    const { next, wasCalled } = createNextFunction();
    middleware(req, res, next);

    expect(wasCalled()).toBe(true);
    expect(res.getStatus()).toBeUndefined();
    expect(res.getSentData()).toBeUndefined();
  });

  it("should return 403 when IP is not in allowlist", () => {
    const compiled = compileRanges(["10.0.0.0/8"]);
    const middleware = makeIpAllowlistMiddleware(compiled, noOpLogger);

    const req = createMockRequest("192.168.1.1");
    const res = createMockResponse();
    const { next, wasCalled } = createNextFunction();

    middleware(req, res, next);

    expect(wasCalled()).toBe(false);
    expect(res.getStatus()).toBe(403);
    expect(res.getSentData()).toBe("Forbidden: IP not allowed");
  });

  it("should block all IPs when allowlist is empty array", () => {
    const compiled = compileRanges([]);
    const middleware = makeIpAllowlistMiddleware(compiled, noOpLogger);

    const req = createMockRequest("192.168.1.1");
    const res = createMockResponse();
    const { next, wasCalled } = createNextFunction();

    middleware(req, res, next);

    expect(wasCalled()).toBe(false);
    expect(res.getStatus()).toBe(403);
    expect(res.getSentData()).toBe("Forbidden: No IPs allowed");
  });

  it("should allow all IPs when allowlist is undefined (feature disabled)", () => {
    const middleware = makeIpAllowlistMiddleware(undefined, noOpLogger);

    const req = createMockRequest("192.168.1.1");
    const res = createMockResponse();
    const { next, wasCalled } = createNextFunction();

    middleware(req, res, next);

    expect(wasCalled()).toBe(true);
    expect(res.getStatus()).toBeUndefined();
    expect(res.getSentData()).toBeUndefined();
  });

  it("should return 400 when req.ip is undefined and allowlist is defined", () => {
    const compiled = compileRanges(["192.168.1.0/24"]);
    const middleware = makeIpAllowlistMiddleware(compiled, noOpLogger);

    const req = createMockRequest(undefined);
    const res = createMockResponse();
    const { next, wasCalled } = createNextFunction();
    middleware(req, res, next);

    expect(wasCalled()).toBe(false);
    expect(res.getStatus()).toBe(400);
    expect(res.getSentData()).toBe("Unable to determine client IP");
  });

  it("should return 400 when req.ip is undefined and allowlist is empty array", () => {
    const compiled = compileRanges([]);
    const middleware = makeIpAllowlistMiddleware(compiled, noOpLogger);

    const req = createMockRequest(undefined);
    const res = createMockResponse();
    const { next, wasCalled } = createNextFunction();
    middleware(req, res, next);
    expect(wasCalled()).toBe(false);
    expect(res.getStatus()).toBe(400);
    expect(res.getSentData()).toBe("Unable to determine client IP");
  });

  it("should allow when req.ip is undefined and allowlist is undefined (feature disabled)", () => {
    const middleware = makeIpAllowlistMiddleware(undefined, noOpLogger);

    const req = createMockRequest(undefined);
    const res = createMockResponse();
    const { next, wasCalled } = createNextFunction();
    middleware(req, res, next);
    expect(wasCalled()).toBe(true);
    expect(res.getStatus()).toBeUndefined();
    expect(res.getSentData()).toBeUndefined();
  });

  it("should handle and return 400 when IP parsing fails", () => {
    const compiled = compileRanges(["192.168.1.0/24"]);
    const middleware = makeIpAllowlistMiddleware(compiled, noOpLogger);

    const req = createMockRequest("invalid-ip-address");
    const res = createMockResponse();
    const { next, wasCalled } = createNextFunction();

    middleware(req, res, next);

    expect(wasCalled()).toBe(false);
    expect(res.getStatus()).toBe(400);
    expect(res.getSentData()).toBe("Unable to determine client IP");
  });
});
