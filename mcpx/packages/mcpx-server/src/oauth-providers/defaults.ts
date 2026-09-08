import { StaticOAuth } from "@mcpx/shared-model";

const GITHUB_STATIC_OAUTH: NonNullable<StaticOAuth> = {
  mapping: {
    "github.com": "lunar-github",
    "api.github.com": "lunar-github",
    "api.githubcopilot.com": "lunar-github",
    "raw.githubusercontent.com": "lunar-github",
  },
  providers: {
    "lunar-github": {
      authMethod: "device_flow",
      credentials: {
        clientId: { type: "envRef", envName: "GITHUB_OAUTH_CLIENT_ID" },
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
export const DEFAULT_STATIC_OAUTH: NonNullable<StaticOAuth> = {
  mapping: {
    ...GITHUB_STATIC_OAUTH.mapping,
  },
  providers: {
    ...GITHUB_STATIC_OAUTH.providers,
  },
};
