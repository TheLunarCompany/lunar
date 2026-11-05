import express from "express";
import { parseArgs } from "node:util";
import { startMockOAuthServers } from "../mock-oauth-servers.js";

const HELP = `Usage: npm run it:mock-oauth -- [options]

  --port <n>                 MCP + OAuth server port (default 9100)
  --control-port <n>         control API port (default 9101)
  --rotate                   rotate refresh tokens with reuse detection
  --token-ttl-seconds <n>    access token lifetime (default 3600)
  --help                     show this text
`;

function parsePort(value: string, flag: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${flag} must be a port number, got "${value}"`);
  }
  return port;
}

function parseStatus(value: string | undefined): number {
  const status = Number(value ?? "429");
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new Error(`status must be between 400 and 599, got "${value}"`);
  }
  return status;
}

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "9100" },
    "control-port": { type: "string", default: "9101" },
    rotate: { type: "boolean", default: false },
    "token-ttl-seconds": { type: "string", default: "3600" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const mcpPort = parsePort(values.port, "--port");
const controlPort = parsePort(values["control-port"], "--control-port");
const tokenTtlSeconds = Number(values["token-ttl-seconds"]);

const servers = await startMockOAuthServers({
  rotate: values.rotate,
  accessTokenTtlMs: tokenTtlSeconds * 1000,
  port: mcpPort,
});

const control = express();

control.get("/status", (_req, res) => {
  res.json({
    resourceServerUrl: servers.resourceServerUrl,
    fault: servers.getMcpFault() ?? null,
    authenticatedMcpRequests: servers.mcpRequests.count,
    refreshes: servers.refreshes,
  });
});

control.post("/fault/mcp", (req, res) => {
  try {
    const status = parseStatus(req.query["status"] as string | undefined);
    const retryAfter = req.query["retryAfter"];
    servers.setMcpFault({
      status,
      retryAfterSeconds:
        typeof retryAfter === "string" ? Number(retryAfter) : undefined,
    });
    res.json({ fault: servers.getMcpFault() });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

control.delete("/fault/mcp", (_req, res) => {
  servers.clearMcpFault();
  res.json({ fault: null });
});

control.post("/fault/token", (req, res) => {
  const count = Number(req.query["count"] ?? "1");
  Array.from({ length: Number.isInteger(count) ? count : 1 }).forEach(() =>
    servers.failNextTokenRequest(),
  );
  res.json({ queuedTokenFailures: count });
});

control.listen(controlPort, () => {
  process.stdout.write(
    `mock MCP: ${servers.resourceServerUrl}\ncontrol:  http://localhost:${controlPort}\n`,
  );
});

const shutdown = (): void => {
  void servers.stop().finally(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
