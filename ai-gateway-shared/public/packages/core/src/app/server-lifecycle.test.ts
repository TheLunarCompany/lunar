import { describe, expect, it } from "@jest/globals";
import { createServer } from "node:http";
import { closeServer } from "./server-lifecycle.js";

describe("closeServer", () => {
  it("waits until the HTTP server has closed", async () => {
    const server = createServer((_, response) => response.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, resolve));

    await closeServer(server);

    expect(server.listening).toBe(false);
  });
});
