import { noOpLogger } from "@mcpx/toolkit-core/logging";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { DiskTokenStore } from "./disk-token-store.js";

// POSIX permission bits are not modelled on Windows, where `chmod` only
// reflects the read-only flag, so these assertions are meaningless there.
const describePosix = process.platform === "win32" ? describe.skip : describe;

const SERVER_NAME = "example-server";

async function modeOf(p: string): Promise<number> {
  return (await fs.stat(p)).mode & 0o777;
}

describePosix("DiskTokenStore file permissions", () => {
  let baseDir: string;
  let tokensDir: string;
  let store: DiskTokenStore;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "disk-token-store-"));
    tokensDir = path.join(baseDir, ".mcpx", "tokens");
    store = new DiskTokenStore(tokensDir, noOpLogger);
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  async function writeAll(): Promise<void> {
    await store.saveTokens(SERVER_NAME, {
      access_token: "access-token",
      token_type: "Bearer",
      refresh_token: "refresh-token",
    });
    await store.saveCodeVerifier(SERVER_NAME, "code-verifier");
    await store.saveClientInfo(SERVER_NAME, {
      client_id: "client-id",
      redirect_uris: ["http://localhost/callback"],
    });
  }

  async function expectRestricted(): Promise<void> {
    expect(await modeOf(tokensDir)).toBe(0o700);
    const entries = await fs.readdir(tokensDir);
    expect(entries.sort()).toEqual([
      `${SERVER_NAME}-client.json`,
      `${SERVER_NAME}-tokens.json`,
      `${SERVER_NAME}-verifier.txt`,
    ]);
    for (const entry of entries) {
      expect([entry, await modeOf(path.join(tokensDir, entry))]).toEqual([
        entry,
        0o600,
      ]);
    }
  }

  it("restricts the tokens directory and its files to the owner", async () => {
    await writeAll();
    await expectRestricted();
  });

  it("tightens a directory and files left over with lax permissions", async () => {
    await fs.mkdir(tokensDir, { recursive: true });
    await fs.chmod(tokensDir, 0o755);
    for (const name of [
      `${SERVER_NAME}-client.json`,
      `${SERVER_NAME}-tokens.json`,
      `${SERVER_NAME}-verifier.txt`,
    ]) {
      const p = path.join(tokensDir, name);
      await fs.writeFile(p, "stale", "utf8");
      await fs.chmod(p, 0o644);
    }

    await writeAll();
    await expectRestricted();
  });

  it("still round-trips what it stored", async () => {
    await writeAll();

    expect(await store.loadTokens(SERVER_NAME)).toMatchObject({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(await store.loadCodeVerifier(SERVER_NAME)).toBe("code-verifier");
    expect(await store.loadClientInfo(SERVER_NAME)).toMatchObject({
      client_id: "client-id",
    });
  });
});
