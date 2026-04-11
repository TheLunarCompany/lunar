import { noOpLogger } from "@mcpx/toolkit-core/logging";
import fs from "fs";
import os from "os";
import path from "path";
import { OAuthProviderFactory } from "./factory.js";

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
