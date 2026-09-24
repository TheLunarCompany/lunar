import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api";
import { fetchSecrets, sortSecrets } from "./secrets";

describe("secrets runtime data", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the real API response even when it is empty", async () => {
    vi.spyOn(apiClient, "getSecrets").mockResolvedValue([]);

    await expect(fetchSecrets()).resolves.toEqual([]);
  });

  it("propagates API errors instead of falling back to mock secrets", async () => {
    const error = new Error("network down");
    vi.spyOn(apiClient, "getSecrets").mockRejectedValue(error);

    await expect(fetchSecrets()).rejects.toThrow("network down");
  });

  it("sorts secrets alphabetically", () => {
    expect(sortSecrets(["STRIPE_SECRET", "API_TOKEN", "DB_PASSWORD"])).toEqual([
      "API_TOKEN",
      "DB_PASSWORD",
      "STRIPE_SECRET",
    ]);
  });
});
