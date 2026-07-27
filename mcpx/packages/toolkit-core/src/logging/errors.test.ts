import { loggableHttpError } from "./errors.js";

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
