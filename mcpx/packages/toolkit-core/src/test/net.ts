import net from "node:net";

export interface TestTcpServer {
  port: number;
  close: () => Promise<void>;
}

export interface TcpServerParams {
  port?: number;
  onConnection?: (socket: net.Socket) => void;
}

// A real TCP listener, for tests that need a reachable address. OS-assigned
// port by default; pass port to bind a specific one (e.g. to revive a port a
// test previously proved dead). Pass onConnection to script socket behavior
// (e.g. destroy it to simulate a mid-connection death). Always await close()
// when done.
export async function startTcpServer(
  params?: TcpServerParams,
): Promise<TestTcpServer> {
  const server = net.createServer(params?.onConnection);
  await new Promise<void>((resolve) =>
    server.listen(params?.port ?? 0, resolve),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("TCP server has no port");
  }
  return {
    port: address.port,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

// Scoped variant of startTcpServer: runs fn with the server and guarantees
// close, whatever fn does.
export async function withTcpServer<T>(
  fn: (server: TestTcpServer) => Promise<T>,
  params?: TcpServerParams,
): Promise<T> {
  const server = await startTcpServer(params);
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}

// A localhost port with nothing listening on it (acquired, then freed), for
// tests that need a connection-refused target.
export async function acquireClosedPort(): Promise<number> {
  const server = await startTcpServer();
  await server.close();
  return server.port;
}
