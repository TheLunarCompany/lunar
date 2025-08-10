// src/playwrightMcp.ts
import http, { IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

/** Handle returned to testRunner so it can shut the server down. */
export interface PlaywrightMcpHandle {
  baseUrl: string;          // host:port (NO path)
  shutdown(): Promise<void>;
  closeTransport(): void;
}

/**
 * Start an in-process Playwright-MCP server.
 *  • Binds on 127.0.0.1:0  (OS chooses a free port)
 *  • Exposes one route  /messages
 *      – GET  → opens SSE stream
 *      – POST → delivers JSON-RPC command via same transport
 */
export async function startPlaywrightMcp(): Promise<PlaywrightMcpHandle> {
  /* ── 1.  Create bare HTTP server on a free port ─────────────────── */
  const server = http.createServer();
  await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address() as AddressInfo;
  const baseUrl  = `http://127.0.0.1:${port}`;

  /* ── 2.  Dynamically import the ESM-only @playwright/mcp ─────────── */
  // Done via Function wrapper so ts-node (CommonJS) doesn’t rewrite to require().
  const { createConnection } = await (new Function(
    'spec', 'return import(spec)'
  )('@playwright/mcp') as Promise<{ createConnection: any }>);

  /* ── 3.  Spin up the headless browser MCP connection ────────────── */
  const mcp = await createConnection({
    browser: {
      isolated: true,              // no persistent profile
      launchOptions: { headless: true }
    }
  });

  /* ── 4.  One SSE transport shared for the whole session ─────────── */
  let transport: SSEServerTransport | undefined;

  server.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url?.startsWith('/messages')) {
      res.writeHead(404).end('Not found');
      return;
    }

    if (req.method === 'GET') {
      // First GET establishes the SSE stream
      transport = new SSEServerTransport('/messages', res as any);
      await mcp.connect(transport);        // handshake -> “endpoint” event
      return;                              // SSE handler keeps res open
    }

    if (req.method === 'POST') {
      if (!transport) {
        res.writeHead(503).end('SSE not established');
        return;
      }

      // Collect body (JSON-RPC message)
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c));
      req.on('end', async () => {
        try {
          await (transport as any).handlePostMessage(
            req,
            res,
            Buffer.concat(chunks).toString('utf8')
          );
        } catch (e: any) {
          res.writeHead(500).end(e.message ?? 'internal error');
        }
      });
      return;
    }

    res.writeHead(405).end('Method not allowed');
  });

  console.log(`[playwright-mcp] listening on ${baseUrl}/messages`);
  return {
    baseUrl,                              // testRunner adds /messages
    shutdown: () => new Promise<void>(ok => server.close(() => ok())),
    closeTransport: () => {
      // sdk ≥0.7 provides transport.close();  fallback to res.end()
      try {
        (transport as any)?.close?.();
      } catch {
        try { (transport as any)?.res?.end(); } catch { /* ignore */ }
      }
    },
  };
}