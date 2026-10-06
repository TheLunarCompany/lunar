import {
  LoggableErrorCause,
  loggableError,
  loggableHttpError,
} from "./errors.js";

describe("loggableError", () => {
  it("reports name, message and stack", () => {
    const result = loggableError(new RangeError("out of range"));
    expect(result.errorName).toBe("RangeError");
    expect(result.errorMessage).toBe("out of range");
    expect(result.errorStack).toContain("out of range");
    expect(result).not.toHaveProperty("errorCode");
    expect(result).not.toHaveProperty("errorCause");
  });

  it("wraps non-errors", () => {
    const result = loggableError({ status: 503 });
    expect(result.errorMessage).toBe('Unknown error ({"status":503})');
  });

  it("follows the cause chain and picks up system error codes", () => {
    const socket = Object.assign(new Error("read ECONNRESET"), {
      code: "ECONNRESET",
    });
    const fetchFailed = new TypeError("fetch failed", { cause: socket });
    const result = loggableError(fetchFailed);
    expect(result.errorMessage).toBe("fetch failed");
    expect(result.errorCause).toEqual({
      errorName: "Error",
      errorMessage: "read ECONNRESET",
      errorCode: "ECONNRESET",
    });
  });

  it("ignores a non-string code", () => {
    const error = Object.assign(new Error("boom"), { code: 42 });
    expect(loggableError(error)).not.toHaveProperty("errorCode");
  });

  it("stops on a cyclic cause chain", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    a.cause = b;
    const result = loggableError(a);
    const depth = (e: LoggableErrorCause | undefined): number =>
      e === undefined ? 0 : 1 + depth(e.errorCause);
    expect(depth(result)).toBe(4);
  });
});

describe("loggableHttpError", () => {
  it("emits a bounded bodyPreview and never a raw body key", () => {
    const result = loggableHttpError({
      status: 500,
      body: { message: "boom" },
    });
    expect(result).not.toHaveProperty("body");
    expect(result["status"]).toBe(500);
    expect(result["bodyPreview"]).toBe('{"message":"boom"}');
  });

  it("passes through string bodies", () => {
    const result = loggableHttpError({ status: 400, body: "bad request" });
    expect(result["bodyPreview"]).toBe("bad request");
  });

  it("always emits bodyPreview, even when body is omitted (sensitive responses)", () => {
    const result = loggableHttpError({ status: 401 });
    expect(result).toHaveProperty("bodyPreview", "");
    expect(result).not.toHaveProperty("body");
  });

  it("merges extra context fields", () => {
    const result = loggableHttpError({
      status: 404,
      body: undefined,
      setupOwnerId: "owner-123",
    });
    expect(result).toMatchObject({
      status: 404,
      setupOwnerId: "owner-123",
      bodyPreview: "",
    });
  });

  it("truncates long bodies and reports the omitted length", () => {
    const body = "x".repeat(600);
    const result = loggableHttpError({ status: 502, body });
    const preview = result["bodyPreview"] as string;
    expect(preview.startsWith("x".repeat(512))).toBe(true);
    expect(preview).toContain("[truncated 88 chars]");
    expect(preview.length).toBeLessThan(body.length);
  });

  it("does not throw on unserializable bodies", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    const result = loggableHttpError({ status: 500, body: circular });
    expect(result["bodyPreview"]).toBe("[unserializable]");
  });
});
