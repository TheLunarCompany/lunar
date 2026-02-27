import { ConfigValidator } from "./config-validator.js";
import { Config } from "../model/config/config.js";
import { resetEnv } from "../env.js";

describe("ConfigValidator", () => {
  let validator: ConfigValidator;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, VERSION: "1.0.0", INSTANCE_ID: "0" };
    resetEnv();
    validator = new ConfigValidator();
  });

  afterEach(() => {
    process.env = { ...originalEnv, VERSION: "1.0.0", INSTANCE_ID: "0" };
    resetEnv();
  });

  const createBaseConfig = (): Config => ({
    permissions: {
      default: { _type: "default-allow", block: [] },
      consumers: {},
    },
    toolGroups: [],
    auth: {
      enabled: false,
    },
    toolExtensions: {
      services: {},
    },
    targetServerAttributes: {},
  });

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

      it("should reject client_credentials provider without client ID", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "client_credentials",
              credentials: {
                clientIdEnv: "GITHUB_CLIENT_ID",
                clientSecretEnv: "GITHUB_CLIENT_SECRET",
              },
              scopes: ["repo"],
              tokenAuthMethod: "client_secret_post",
            },
          },
        };
        delete process.env["GITHUB_CLIENT_ID"];
        delete process.env["GITHUB_CLIENT_SECRET"];

        await expect(validator.prepareConfig(config)).rejects.toThrow(
          "Static OAuth provider github is missing credentials. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.",
        );
      });

      it("should reject client_credentials provider without client secret", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "client_credentials",
              credentials: {
                clientIdEnv: "GITHUB_CLIENT_ID",
                clientSecretEnv: "GITHUB_CLIENT_SECRET",
              },
              scopes: ["repo"],
              tokenAuthMethod: "client_secret_post",
            },
          },
        };
        process.env["GITHUB_CLIENT_ID"] = "test-client-id";
        delete process.env["GITHUB_CLIENT_SECRET"];

        await expect(validator.prepareConfig(config)).rejects.toThrow(
          "Static OAuth provider github is missing credentials. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.",
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
                clientIdEnv: "GITHUB_CLIENT_ID",
                clientSecretEnv: "GITHUB_CLIENT_SECRET",
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

      it("should reject device_flow provider without client ID", async () => {
        const config = createBaseConfig();
        config.staticOauth = {
          mapping: { "github.com": "github" },
          providers: {
            github: {
              authMethod: "device_flow",
              credentials: {
                clientIdEnv: "GITHUB_CLIENT_ID",
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
          "Device flow OAuth provider github is missing client ID. Please set GITHUB_CLIENT_ID environment variable.",
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
                clientIdEnv: "GITHUB_CLIENT_ID",
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
                clientIdEnv: "GITHUB_CLIENT_ID",
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
                clientIdEnv: "GITLAB_CLIENT_ID",
                clientSecretEnv: "GITLAB_CLIENT_SECRET",
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
