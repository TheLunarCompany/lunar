import { noOpLogger } from "@mcpx/toolkit-core/logging";
import fs from "fs";
import os from "os";
import path from "path";
import { OAuthProviderFactory } from "./factory.js";
import { DcrOAuthProvider } from "./dcr.js";

describe("OAuthProviderFactory", () => {
  describe(".deleteTokensForServer", () => {
    let tokensDir: string;

    beforeEach(() => {
      tokensDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpx-test-"));
    });

    afterEach(() => {
      fs.rmSync(tokensDir, { recursive: true, force: true });
    });

    it("should delete all token files for a server", async () => {
      const factory = new OAuthProviderFactory(noOpLogger, { tokensDir });

      const tokensFile = path.join(tokensDir, "myserver-tokens.json");
      const verifierFile = path.join(tokensDir, "myserver-verifier.txt");
      const clientFile = path.join(tokensDir, "myserver-client.json");
      fs.writeFileSync(tokensFile, JSON.stringify({ access_token: "tok" }));
      fs.writeFileSync(verifierFile, "verifier");
      fs.writeFileSync(clientFile, JSON.stringify({ client_id: "id" }));

      await factory.deleteTokensForServer("myserver");

      expect(fs.existsSync(tokensFile)).toBe(false);
      expect(fs.existsSync(verifierFile)).toBe(false);
      expect(fs.existsSync(clientFile)).toBe(false);
    });

    it("should not throw when token files do not exist", async () => {
      const factory = new OAuthProviderFactory(noOpLogger, { tokensDir });

      await expect(
        factory.deleteTokensForServer("nonexistent"),
      ).resolves.not.toThrow();
    });

    it("should only delete files for the specified server", async () => {
      const factory = new OAuthProviderFactory(noOpLogger, { tokensDir });

      const targetFile = path.join(tokensDir, "target-tokens.json");
      const otherFile = path.join(tokensDir, "other-tokens.json");
      fs.writeFileSync(targetFile, JSON.stringify({ access_token: "target" }));
      fs.writeFileSync(otherFile, JSON.stringify({ access_token: "other" }));

      await factory.deleteTokensForServer("target");

      expect(fs.existsSync(targetFile)).toBe(false);
      expect(fs.existsSync(otherFile)).toBe(true);
    });
  });
});

describe("DcrOAuthProvider token expiry", () => {
  let tokensDir: string;

  beforeEach(() => {
    tokensDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcpx-dcr-test-"));
  });

  afterEach(() => {
    fs.rmSync(tokensDir, { recursive: true, force: true });
  });

  function makeProvider(): DcrOAuthProvider {
    return new DcrOAuthProvider({
      serverName: "test-server",
      logger: noOpLogger,
      tokensDir,
    });
  }

  it("saveTokens stores expires_at computed from expires_in", async () => {
    const provider = makeProvider();
    const before = Date.now();
    await provider.saveTokens({
      access_token: "tok",
      token_type: "bearer",
      expires_in: 3600,
    });
    const after = Date.now();

    const raw = JSON.parse(
      fs.readFileSync(path.join(tokensDir, "test-server-tokens.json"), "utf8"),
    ) as { expires_at?: number };

    expect(raw.expires_at).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(raw.expires_at).toBeLessThanOrEqual(after + 3600 * 1000);
  });

  it("tokens() returns tokens before expiry", async () => {
    const provider = makeProvider();
    await provider.saveTokens({
      access_token: "tok",
      token_type: "bearer",
      expires_in: 3600,
    });

    const result = await provider.tokens();

    expect(result?.access_token).toBe("tok");
  });

  it("tokens() returns undefined when expires_at is in the past", async () => {
    const provider = makeProvider();
    const tokensPath = path.join(tokensDir, "test-server-tokens.json");
    fs.writeFileSync(
      tokensPath,
      JSON.stringify({
        access_token: "tok",
        token_type: "bearer",
        expires_at: Date.now() - 1,
      }),
    );

    const result = await provider.tokens();

    expect(result).toBeUndefined();
  });

  it("tokens() returns tokens when expires_at is absent (backward compat)", async () => {
    const provider = makeProvider();
    const tokensPath = path.join(tokensDir, "test-server-tokens.json");
    fs.writeFileSync(
      tokensPath,
      JSON.stringify({ access_token: "old-tok", token_type: "bearer" }),
    );

    const result = await provider.tokens();

    expect(result?.access_token).toBe("old-tok");
  });
});
