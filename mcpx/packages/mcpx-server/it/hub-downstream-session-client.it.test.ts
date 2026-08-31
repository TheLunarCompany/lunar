import { io as connectSocketIO, Socket } from "socket.io-client";
import { SemVer } from "semver";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { HubDownstreamSessionClient } from "../src/services/hub-downstream-session-client.js";
import { HubSocketAdapter } from "../src/services/saved-setups-client.js";
import { PersistedDownstreamSessionData } from "../src/services/downstream-session-store.js";
import { MockHubServer } from "./mock-hub-server.js";

const HUB_PORT = 3099;
const SETUP_OWNER_ID = "it-run";

function makeSocketAdapter(socket: Socket): HubSocketAdapter {
  return {
    emitWithAck: (event, envelope) => socket.emitWithAck(event, envelope),
  };
}

async function waitForConnect(socket: Socket): Promise<void> {
  if (socket.connected) return;
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
}

describe("HubDownstreamSessionClient", () => {
  let hub: MockHubServer;
  let socket: Socket;
  let client: HubDownstreamSessionClient;

  beforeAll(async () => {
    hub = new MockHubServer({ port: HUB_PORT, logger: noOpLogger });
    hub.setValidTokens([SETUP_OWNER_ID]);
    await hub.waitForListening();
  });

  afterAll(async () => {
    await hub.close();
  });

  beforeEach(async () => {
    socket = connectSocketIO(`http://localhost:${HUB_PORT}`, {
      path: "/v1/ws",
      auth: { setupOwnerId: SETUP_OWNER_ID },
    });
    await waitForConnect(socket);
    const adapter = makeSocketAdapter(socket);
    client = new HubDownstreamSessionClient(() => adapter, noOpLogger);
    hub.clearDownstreamSessions();
  });

  afterEach(() => {
    socket.disconnect();
  });

  const SESSION_ID = "session-abc";

  const SESSION_DATA: PersistedDownstreamSessionData = {
    metadata: {
      clientId: "client-1",
      isProbe: false,
      clientInfo: {
        name: "mcp-remote",
        adapter: {
          name: "mcp-remote",
          version: new SemVer("1.2.3"),
          support: { ping: true },
        },
      },
    },
  };

  it("store then load returns the original data with SemVer reconstructed", async () => {
    await client.store(SESSION_ID, SESSION_DATA);

    const loaded = await client.load(SESSION_ID);

    expect(loaded).toBeDefined();
    expect(loaded!.metadata.clientId).toBe("client-1");
    expect(loaded!.metadata.clientInfo.adapter?.version).toBeInstanceOf(SemVer);
    expect(loaded!.metadata.clientInfo.adapter?.version?.toString()).toBe(
      "1.2.3",
    );
  });

  it("store serializes SemVer to string on the wire", async () => {
    await client.store(SESSION_ID, SESSION_DATA);

    const wire = hub.getDownstreamSession(SESSION_ID);
    expect(wire?.metadata.clientInfo.adapter?.version).toBe("1.2.3");
  });

  it("load returns undefined when session not found", async () => {
    const result = await client.load("nonexistent-session");
    expect(result).toBeUndefined();
  });

  it("store then delete then load returns undefined", async () => {
    await client.store(SESSION_ID, SESSION_DATA);
    await client.delete(SESSION_ID);

    const result = await client.load(SESSION_ID);
    expect(result).toBeUndefined();
  });

  it("store is a no-op when socket is null", async () => {
    const noSocketClient = new HubDownstreamSessionClient(
      () => null,
      noOpLogger,
    );
    await expect(
      noSocketClient.store(SESSION_ID, SESSION_DATA),
    ).resolves.toBeUndefined();
  });
});
