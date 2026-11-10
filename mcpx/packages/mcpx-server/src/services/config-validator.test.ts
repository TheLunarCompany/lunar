import { ConfigValidator } from "./config-validator.js";
import { DEFAULT_CONFIG } from "../config.js";
import { Config } from "../model/config/config.js";
import { resetEnv } from "../env.js";
import { EnvVarManager } from "./env-var-manager.js";
import { CatalogHostsResolver } from "./catalog-manager.js";
import { noOpLogger } from "@aigw/core/logging";

describe("ConfigValidator", () => {
  let validator: ConfigValidator;
  const originalEnv = { ...process.env };

  function stubCatalogResolver(
    hostsInCatalog?: string[],
  ): CatalogHostsResolver {
    return {
      isHostInCatalog: (host) =>
        hostsInCatalog ? hostsInCatalog.includes(host) : true,
    };
  }

  beforeEach(() => {
    process.env = { ...originalEnv, VERSION: "1.0.0", INSTANCE_ID: "0" };
    resetEnv();
    validator = new ConfigValidator(
      new EnvVarManager(noOpLogger),
      stubCatalogResolver(),
      noOpLogger,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv, VERSION: "1.0.0", INSTANCE_ID: "0" };
    resetEnv();
    jest.restoreAllMocks();
  });

  const createBaseConfig = (): Config => structuredClone(DEFAULT_CONFIG);

  describe("prepareConfig", () => {
    it("should validate config with auth disabled", async () => {
      const config = createBaseConfig();

      await expect(validator.prepareConfig(config)).resolves.toBeUndefined();
    });

    it("should reject when auth is enabled but AUTH_KEY is missing", async () => {
      const config = createBaseConfig();
      config.auth.enabled = true;
      delete process.env["AUTH_KEY"];

      await expect(validator.prepareConfig(config)).rejects.toThrow(
        "AUTH_KEY is required when auth is enabled",
      );
    });

    it("should validate when auth is enabled and AUTH_KEY is present", async () => {
      const config = createBaseConfig();
      config.auth.enabled = true;
      process.env["AUTH_KEY"] = "test-auth-key";
      resetEnv();

      await expect(validator.prepareConfig(config)).resolves.toBeUndefined();
    });

    describe("static OAuth validation", () => {
      it("should validate config without static OAuth", async () => {
        const config = createBaseConfig();

        await expect(validator.prepareConfig(config)).resolves.toBeUndefined();
      });

      it("should reject when client_credentials provider is missing credentials", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "client_credentials",
              credentials: {
                clientId: { type: "envRef", envName: "GITHUB_CLIENT_ID" },
                clientSecret: {
                  type: "envRef",
                  envName: "GITHUB_CLIENT_SECRET",
                },
              },
              scopes: ["repo"],
              tokenAuthMethod: "client_secret_post",
            },
          },
        };
        delete process.env["GITHUB_CLIENT_ID"];
        delete process.env["GITHUB_CLIENT_SECRET"];

        await expect(validator.prepareConfig(config)).rejects.toThrow(
          "Static OAuth provider github is missing credentials. Ensure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables are available.",
        );
      });

      it("should reject when client_credentials provider is missing client secret", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "client_credentials",
              credentials: {
                clientId: { type: "envRef", envName: "GITHUB_CLIENT_ID" },
                clientSecret: {
                  type: "envRef",
                  envName: "GITHUB_CLIENT_SECRET",
                },
              },
              scopes: ["repo"],
              tokenAuthMethod: "client_secret_post",
            },
          },
        };
        process.env["GITHUB_CLIENT_ID"] = "test-client-id";
        delete process.env["GITHUB_CLIENT_SECRET"];

        await expect(validator.prepareConfig(config)).rejects.toThrow(
          "Static OAuth provider github is missing credentials. Ensure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables are available.",
        );
      });

      it("should validate client_credentials provider with both credentials", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "client_credentials",
              credentials: {
                clientId: { type: "envRef", envName: "GITHUB_CLIENT_ID" },
                clientSecret: {
                  type: "envRef",
                  envName: "GITHUB_CLIENT_SECRET",
                },
              },
              scopes: ["repo"],
              tokenAuthMethod: "client_secret_post",
            },
          },
        };
        process.env["GITHUB_CLIENT_ID"] = "test-client-id";
        process.env["GITHUB_CLIENT_SECRET"] = "test-client-secret";

        await expect(validator.prepareConfig(config)).resolves.toBeUndefined();
      });

      it("should reject when device_flow provider is missing client ID", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "device_flow",
              credentials: {
                clientId: { type: "envRef", envName: "GITHUB_CLIENT_ID" },
              },
              scopes: ["repo"],
              endpoints: {
                deviceAuthorizationUrl: "https://github.com/login/device/code",
                tokenUrl: "https://github.com/login/oauth/access_token",
                userVerificationUrl: "https://github.com/login/device",
              },
            },
          },
        };
        delete process.env["GITHUB_CLIENT_ID"];
        await expect(validator.prepareConfig(config)).rejects.toThrow(
          "Device flow OAuth provider github is missing client ID. Ensure GITHUB_CLIENT_ID environment variable is available.",
        );
      });

      it("should validate device_flow provider with client ID", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "device_flow",
              credentials: {
                clientId: { type: "envRef", envName: "GITHUB_CLIENT_ID" },
              },
              scopes: ["repo"],
              endpoints: {
                deviceAuthorizationUrl: "https://github.com/login/device/code",
                tokenUrl: "https://github.com/login/oauth/access_token",
                userVerificationUrl: "https://github.com/login/device",
              },
            },
          },
        };
        process.env["GITHUB_CLIENT_ID"] = "test-client-id";

        await expect(validator.prepareConfig(config)).resolves.toBeUndefined();
      });

      it("should skip validation for a provider not used by any catalog server", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "unused.example.com": "unused" },
          providers: {
            unused: {
              authMethod: "client_credentials",
              credentials: {
                clientId: { type: "envRef", envName: "UNUSED_CLIENT_ID" },
                clientSecret: {
                  type: "envRef",
                  envName: "UNUSED_CLIENT_SECRET",
                },
              },
              scopes: [],
              tokenAuthMethod: "client_secret_post",
            },
          },
        };

        const validatorWithEmptyCatalog = new ConfigValidator(
          new EnvVarManager(noOpLogger),
          stubCatalogResolver([]),
          noOpLogger,
        );
        await expect(
          validatorWithEmptyCatalog.prepareConfig(config),
        ).resolves.toBeUndefined();
      });

      it("should reject a provider used by a catalog server when credentials are absent", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "client_credentials",
              credentials: {
                clientId: { type: "envRef", envName: "GITHUB_CLIENT_ID" },
                clientSecret: {
                  type: "envRef",
                  envName: "GITHUB_CLIENT_SECRET",
                },
              },
              scopes: [],
              tokenAuthMethod: "client_secret_post",
            },
          },
        };
        delete process.env["GITHUB_CLIENT_ID"];
        delete process.env["GITHUB_CLIENT_SECRET"];

        const validatorWithGithub = new ConfigValidator(
          new EnvVarManager(noOpLogger),
          stubCatalogResolver(["github.com"]),
          noOpLogger,
        );
        await expect(validatorWithGithub.prepareConfig(config)).rejects.toThrow(
          "Static OAuth provider github is missing credentials.",
        );
      });

      it("should skip validation for a provider with no mapped hosts", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: {},
          providers: {
            unused: {
              authMethod: "device_flow",
              credentials: {
                clientId: { type: "envRef", envName: "UNUSED_CLIENT_ID" },
              },
              scopes: [],
              endpoints: {
                deviceAuthorizationUrl: "https://example.com/device",
                tokenUrl: "https://example.com/token",
                userVerificationUrl: "https://example.com/verify",
              },
            },
          },
        };

        await expect(validator.prepareConfig(config)).resolves.toBeUndefined();
      });

      it("should validate multiple OAuth providers", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: {
            "github.com": "github",
            "gitlab.com": "gitlab",
          },
          providers: {
            github: {
              authMethod: "device_flow",
              credentials: {
                clientId: { type: "envRef", envName: "GITHUB_CLIENT_ID" },
              },
              scopes: ["repo"],
              endpoints: {
                deviceAuthorizationUrl: "https://github.com/login/device/code",
                tokenUrl: "https://github.com/login/oauth/access_token",
                userVerificationUrl: "https://github.com/login/device",
              },
            },
            gitlab: {
              authMethod: "client_credentials",
              credentials: {
                clientId: { type: "envRef", envName: "GITLAB_CLIENT_ID" },
                clientSecret: {
                  type: "envRef",
                  envName: "GITLAB_CLIENT_SECRET",
                },
              },
              scopes: ["api"],
              tokenAuthMethod: "client_secret_post",
            },
          },
        };
        process.env["GITHUB_CLIENT_ID"] = "github-client-id";
        process.env["GITLAB_CLIENT_ID"] = "gitlab-client-id";
        process.env["GITLAB_CLIENT_SECRET"] = "gitlab-client-secret";

        await expect(validator.prepareConfig(config)).resolves.toBeUndefined();
      });
    });
  });
});
