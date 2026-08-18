import { describe, expect, it } from "vitest";

import {
  buildReferenceOptions,
  resolveReferenceValue,
} from "./referenceOptions";

describe("reference autocomplete options", () => {
  it("returns only matching secrets for the dropdown", () => {
    expect(
      buildReferenceOptions("DB_PASS", [
        "DB_PASSWORD",
        "GITHUB_TOKEN",
        "DB_PASS_FALLBACK",
      ]),
    ).toEqual([
      {
        key: "secret:DB_PASS_FALLBACK",
        kind: "secret",
        value: "DB_PASS_FALLBACK",
        label: "DB_PASS_FALLBACK",
      },
      {
        key: "secret:DB_PASSWORD",
        kind: "secret",
        value: "DB_PASSWORD",
        label: "DB_PASSWORD",
      },
    ]);
  });

  it("shows all secrets for empty or whitespace-only queries", () => {
    expect(buildReferenceOptions("   ", ["DB_PASSWORD"])).toEqual([
      {
        key: "secret:DB_PASSWORD",
        kind: "secret",
        value: "DB_PASSWORD",
        label: "DB_PASSWORD",
      },
    ]);
  });

  it("deduces fromSecret only for exact secret matches", () => {
    expect(
      resolveReferenceValue("UPSTREAM_URL", ["DB_PASSWORD", "API_TOKEN"]),
    ).toEqual({ mode: "fromEnv", value: { fromEnv: "UPSTREAM_URL" } });

    expect(
      resolveReferenceValue("DB_PASSWORD", ["DB_PASSWORD", "API_TOKEN"]),
    ).toEqual({ mode: "fromSecret", value: { fromSecret: "DB_PASSWORD" } });
  });
});
