import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api";
import {
  addMcpServer,
  deleteMcpServer,
  editMcpServer,
  setTargetServerActive,
} from "./mcp-server";

// These writes moved off the /ws-ui socket to REST (RND-809); guard that each
// path routes through apiClient and never touches the socket.
describe("mcp-server data layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a custom server via POST /target-server", async () => {
    const spy = vi
      .spyOn(apiClient, "addTargetServer")
      .mockResolvedValue({ name: "custom" } as never);

    await addMcpServer({
      payload: { type: "stdio", name: "custom", command: "npx", args: [] },
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ name: "custom" });
  });

  it("adds a catalog server via the catalog endpoint", async () => {
    const custom = vi.spyOn(apiClient, "addTargetServer");
    const catalog = vi
      .spyOn(apiClient, "addCatalogServer")
      .mockResolvedValue({ name: "slack" } as never);

    await addMcpServer({
      payload: {
        catalogItemId: "cat-1",
        type: "stdio",
        name: "slack",
        command: "npx",
        args: [],
        env: {},
      },
    });

    expect(catalog).toHaveBeenCalledWith("cat-1", { envValues: {} });
    expect(custom).not.toHaveBeenCalled();
  });

  it("edits a custom server via PATCH /target-server/:name", async () => {
    const spy = vi
      .spyOn(apiClient, "updateTargetServer")
      .mockResolvedValue({ name: "custom" } as never);

    await editMcpServer({
      name: "custom",
      payload: { type: "stdio", command: "npx", args: [], env: {} },
    });

    expect(spy).toHaveBeenCalledWith("custom", {
      type: "stdio",
      command: "npx",
      args: [],
      env: {},
    });
  });

  it("edits a catalog server via the catalog endpoint", async () => {
    const custom = vi.spyOn(apiClient, "updateTargetServer");
    const catalog = vi
      .spyOn(apiClient, "updateCatalogServer")
      .mockResolvedValue({ name: "slack" } as never);

    await editMcpServer({
      name: "slack",
      payload: {
        catalogItemId: "cat-1",
        type: "stdio",
        command: "npx",
        args: [],
        env: {},
      },
    });

    expect(catalog).toHaveBeenCalledOnce();
    expect(custom).not.toHaveBeenCalled();
  });

  it("deletes a server via DELETE /target-server/:name", async () => {
    const spy = vi
      .spyOn(apiClient, "deleteTargetServer")
      .mockResolvedValue({ message: "ok" });

    await deleteMcpServer({ name: "custom" });

    expect(spy).toHaveBeenCalledWith("custom");
  });

  it("activates a server when active=true, deactivates otherwise", async () => {
    const activate = vi
      .spyOn(apiClient, "activateTargetServer")
      .mockResolvedValue({ message: "on" });
    const deactivate = vi
      .spyOn(apiClient, "deactivateTargetServer")
      .mockResolvedValue({ message: "off" });

    await setTargetServerActive({ name: "custom", active: true });
    expect(activate).toHaveBeenCalledWith("custom");
    expect(deactivate).not.toHaveBeenCalled();

    await setTargetServerActive({ name: "custom", active: false });
    expect(deactivate).toHaveBeenCalledWith("custom");
  });
});
