import { IncomingHttpHeaders } from "http";
import { headerString } from "./headers.js";

describe("headerString", () => {
  it("returns a string header value", () => {
    const headers: IncomingHttpHeaders = { authorization: "Bearer token" };
    expect(headerString(headers, "authorization")).toBe("Bearer token");
  });

  it("returns the first element when header is an array", () => {
    const headers: IncomingHttpHeaders = {
      "x-custom": ["first", "second"],
    };
    expect(headerString(headers, "x-custom")).toBe("first");
  });

  it("returns undefined for missing headers", () => {
    const headers: IncomingHttpHeaders = {};
    expect(headerString(headers, "authorization")).toBeUndefined();
  });
});
