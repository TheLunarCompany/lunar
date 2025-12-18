import { sanitizeTargetServerForTelemetry } from "./control-plane-service.js";
import type { TargetServerRequest } from "@mcpx/shared-model";

describe("sanitizeTargetServerForTelemetry", () => {
  it("omits env", () => {
    const server: TargetServerRequest = {
      name: "my-server",
      type: "stdio",
      command: "cmd",
      args: ["--flag"],
      env: { SECRET: "value", NORMAL: "ok" },
    };

    const result = sanitizeTargetServerForTelemetry(server);

    expect(result).toEqual({
      name: "my-server",
      type: "stdio",
      command: "cmd",
      args: ["--flag"],
    });
  });
});
