import { IncomingMessage, Server, ServerResponse, createServer } from "http";
import { caseSensitiveFetch } from "./fetch.js";

interface CapturedRequest {
  method: string | undefined;
  url: string | undefined;
  rawHeaders: string[];
  body: string;
}

describe("caseSensitiveFetch", () => {
  let server: Server;
  let baseUrl: string;
  const captured: CapturedRequest[] = [];

  beforeAll(async () => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        captured.push({
          method: req.method,
          url: req.url,
          rawHeaders: req.rawHeaders,
          body: Buffer.concat(chunks).toString("utf8"),
        });
        if (req.url === "/slow") {
          // Never responds — lets abort tests take the signal path.
          return;
        }
        if (req.url === "/multi-value") {
          res.setHeader("Set-Cookie", ["a=1", "b=2"]);
        }
        res.setHeader("Content-Type", "application/json");
        res.statusCode = req.url === "/created" ? 201 : 200;
        res.end(JSON.stringify({ echo: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected server to listen on a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  beforeEach(() => {
    captured.length = 0;
  });

  it("preserves header name casing on the wire", async () => {
    await caseSensitiveFetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { AppUserId: "user-1", AppUserAccountId: "account-1" },
      body: JSON.stringify({}),
    });

    // rawHeaders preserves the exact wire format: [name, value, name, value...]
    expect(captured[0]?.rawHeaders).toEqual(
      expect.arrayContaining(["AppUserId", "AppUserAccountId"]),
    );
  });

  it("round-trips method, url, body, status and json", async () => {
    const response = await caseSensitiveFetch(`${baseUrl}/created`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector_id: "zulip" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ echo: true });
    expect(captured[0]).toMatchObject({
      method: "POST",
      url: "/created",
      body: JSON.stringify({ connector_id: "zulip" }),
    });
  });

  it("exposes text() and response headers", async () => {
    const response = await caseSensitiveFetch(`${baseUrl}/ok`);

    expect(await response.text()).toBe(JSON.stringify({ echo: true }));
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("collects multi-value response headers", async () => {
    const response = await caseSensitiveFetch(`${baseUrl}/multi-value`);

    expect(response.headers.get("set-cookie")).toBe("a=1, b=2");
  });

  it("defaults to GET with no headers", async () => {
    await caseSensitiveFetch(`${baseUrl}/plain`);

    expect(captured[0]?.method).toBe("GET");
  });

  it("rejects when the signal aborts", async () => {
    await expect(
      caseSensitiveFetch(`${baseUrl}/slow`, {
        signal: AbortSignal.timeout(50),
      }),
    ).rejects.toThrow();
  });

  it("rejects non-string bodies without sending", async () => {
    await expect(
      caseSensitiveFetch(`${baseUrl}/register`, {
        method: "POST",
        body: new Blob([JSON.stringify({})]),
      }),
    ).rejects.toThrow(TypeError);
    expect(captured).toHaveLength(0);
  });

  it("rejects on connection errors", async () => {
    // Port 1 is reserved and never listening locally.
    await expect(caseSensitiveFetch("http://127.0.0.1:1/nope")).rejects.toThrow(
      /ECONNREFUSED/,
    );
  });
});
