import { StaticOAuth } from "@mcpx/shared-model";

const GITHUB_STATIC_OAUTH: StaticOAuth = {
  mapping: {
    "github.com": "github",
    "api.github.com": "github",
    "api.githubcopilot.com": "github",
    "raw.githubusercontent.com": "github",
  },
  providers: {
    github: {
      authMethod: "device_flow",
      credentials: {
        clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
      },
      scopes: ["repo", "user", "read:org"],
      endpoints: {
        deviceAuthorizationUrl: "https://github.com/login/device/code",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userVerificationUrl: "https://github.com/login/device",
      },
    },
  },
};

/**
 * Default static OAuth configuration for well-known providers
 */
export const DEFAULT_STATIC_OAUTH: StaticOAuth = {
  mapping: {
    ...GITHUB_STATIC_OAUTH.mapping,
  },
  providers: {
    ...GITHUB_STATIC_OAUTH.providers,
  },
};
