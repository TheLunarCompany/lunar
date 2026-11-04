import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v4";

const sdkTransportInternalsSchema = z.object({
  _webStandardTransport: z.object({
    _initialized: z.boolean(),
    sessionId: z.string().optional(),
  }),
});

type SdkTransportInternals = z.infer<typeof sdkTransportInternalsSchema>;

function hasSdkTransportInternals(
  value: unknown,
): value is SdkTransportInternals {
  return sdkTransportInternalsSchema.safeParse(value).success;
}

export function markSessionInitialized(
  transport: StreamableHTTPServerTransport,
  sessionId: string,
): void {
  const internals: unknown = transport;
  if (!hasSdkTransportInternals(internals)) {
    throw new Error(
      "MCP SDK transport internals changed; cannot restore the session",
    );
  }
  // The SDK only accepts non-initialize requests after `initialize` ran on that
  // exact transport instance, tracked by a private `_initialized` flag. A session
  // restored after a pod restart never sees `initialize` again, and the SDK has no
  // public way to hydrate one: https://github.com/modelcontextprotocol/typescript-sdk/issues/1786
  internals._webStandardTransport._initialized = true;
  internals._webStandardTransport.sessionId = sessionId;
}
