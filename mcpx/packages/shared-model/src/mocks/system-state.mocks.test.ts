import { connectedClientSchema } from "../api/system-state.js";
import {
  buildConnectedClientMock,
  connectedClientMock,
  connectedClientMocks,
  disconnectedClientMock,
  unresponsiveClientMock,
} from "./system-state.mocks.js";

describe("system-state mock fixtures", () => {
  it.each([
    ["connected", connectedClientMock],
    ["unresponsive", unresponsiveClientMock],
    ["disconnected", disconnectedClientMock],
  ])("the %s fixture conforms to connectedClientSchema", (_name, fixture) => {
    expect(() => connectedClientSchema.parse(fixture)).not.toThrow();
  });

  it("buildConnectedClientMock produces a schema-valid client with overrides applied", () => {
    const client = buildConnectedClientMock({
      sessionId: "sess-x",
      connectionState: "unresponsive",
    });
    expect(() => connectedClientSchema.parse(client)).not.toThrow();
    expect(client.sessionId).toBe("sess-x");
    expect(client.connectionState).toBe("unresponsive");
  });

  it("covers all three connection states", () => {
    expect(connectedClientMocks.map((c) => c.connectionState).sort()).toEqual([
      "connected",
      "disconnected",
      "unresponsive",
    ]);
  });

  it("only the disconnected fixture carries disconnectedAt", () => {
    expect(connectedClientMock.disconnectedAt).toBeUndefined();
    expect(unresponsiveClientMock.disconnectedAt).toBeUndefined();
    expect(disconnectedClientMock.disconnectedAt).toBeDefined();
  });
});
