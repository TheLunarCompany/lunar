import { noOpLogger } from "@aigw/core/logging";
import { HubTokenClient } from "./hub-token-client.js";
import { TokenStoreUnavailableError } from "./oauth-token-store.js";
import { HubSocketAdapter } from "./saved-setups-client.js";

const SERVER_NAME = "clickup";

function clientWith(socket: HubSocketAdapter | null): HubTokenClient {
  return new HubTokenClient(() => socket, noOpLogger);
}

async function loadError(client: HubTokenClient): Promise<unknown> {
  return client.loadTokens(SERVER_NAME).then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe("HubTokenClient.loadTokens", () => {
  it("reports the store as unavailable when the Hub is not connected", async () => {
    const error = await loadError(clientWith(null));

    expect(error).toBeInstanceOf(TokenStoreUnavailableError);
  });

  it("reports the store as unavailable when the Hub does not answer", async () => {
    const error = await loadError(
      clientWith({
        emitWithAck: async () => {
          throw new Error("operation has timed out");
        },
      }),
    );

    expect(error).toBeInstanceOf(TokenStoreUnavailableError);
  });

  it("reports an answer the Hub gave as a plain error, not as unavailable", async () => {
    const error = await loadError(
      clientWith({
        emitWithAck: async () => ({
          success: false,
          error: "Stored token data is invalid",
        }),
      }),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(TokenStoreUnavailableError);
  });
});
