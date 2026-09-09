import { appendToQueryParam } from "./query-params.js";

describe("appendToQueryParam", () => {
  it("appends the value when the param exists with multiple other values", () => {
    const searchParams = new URLSearchParams("scope=read write");
    appendToQueryParam({
      searchParams,
      paramName: "scope",
      valueToAppend: "offline_access",
      delimiter: " ",
    });
    expect(searchParams.get("scope")).toBe("read write offline_access");
  });

  it("sets the value when the param is absent", () => {
    const searchParams = new URLSearchParams();
    appendToQueryParam({
      searchParams,
      paramName: "scope",
      valueToAppend: "read",
      delimiter: " ",
    });
    expect(searchParams.get("scope")).toBe("read");
  });

  it("does not re-add the value when already present", () => {
    const searchParams = new URLSearchParams("scope=read write offline_access");
    appendToQueryParam({
      searchParams,
      paramName: "scope",
      valueToAppend: "write",
      delimiter: " ",
    });
    expect(searchParams.get("scope")).toBe("read write offline_access");
  });
});
