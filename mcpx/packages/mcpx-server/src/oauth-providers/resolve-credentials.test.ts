import { OauthCredentialResolver } from "../services/env-var-manager.js";
import {
  resolveClientCredentials,
  resolveClientId,
} from "./resolve-credentials.js";

function makeEnvVars(values: Record<string, string>): OauthCredentialResolver {
  return { resolveOauthCredential: (name) => values[name] };
}

const emptyEnvVars: OauthCredentialResolver = {
  resolveOauthCredential: () => undefined,
};

describe("resolveClientId", () => {
  it("returns the literal value", () => {
    const result = resolveClientId(
      { clientId: { type: "literal", value: "id-abc" } },
      emptyEnvVars,
    );
    expect(result).toBe("id-abc");
  });

  it("resolves an envRef via the resolver", () => {
    const result = resolveClientId(
      { clientId: { type: "envRef", envName: "GH_CLIENT_ID" } },
      makeEnvVars({ GH_CLIENT_ID: "id-from-env" }),
    );
    expect(result).toBe("id-from-env");
  });

  it("returns undefined when an envRef cannot be resolved", () => {
    const result = resolveClientId(
      { clientId: { type: "envRef", envName: "MISSING" } },
      emptyEnvVars,
    );
    expect(result).toBeUndefined();
  });
});

describe("resolveClientCredentials", () => {
  it("resolves both literals", () => {
    const result = resolveClientCredentials(
      {
        clientId: { type: "literal", value: "id-abc" },
        clientSecret: { type: "literal", value: "secret-xyz" },
      },
      emptyEnvVars,
    );
    expect(result).toEqual({ clientId: "id-abc", clientSecret: "secret-xyz" });
  });

  it("resolves both envRefs from the resolver", () => {
    const result = resolveClientCredentials(
      {
        clientId: { type: "envRef", envName: "GH_CLIENT_ID" },
        clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
      },
      makeEnvVars({
        GH_CLIENT_ID: "id-from-env",
        GH_CLIENT_SECRET: "secret-from-env",
      }),
    );
    expect(result).toEqual({
      clientId: "id-from-env",
      clientSecret: "secret-from-env",
    });
  });

  it("resolves a mixed pair (literal id + envRef secret)", () => {
    const result = resolveClientCredentials(
      {
        clientId: { type: "literal", value: "public-id-abc" },
        clientSecret: { type: "envRef", envName: "GH_CLIENT_SECRET" },
      },
      makeEnvVars({ GH_CLIENT_SECRET: "secret-from-env" }),
    );
    expect(result).toEqual({
      clientId: "public-id-abc",
      clientSecret: "secret-from-env",
    });
  });

  it("returns undefined when the envRef secret is missing", () => {
    const result = resolveClientCredentials(
      {
        clientId: { type: "literal", value: "id-abc" },
        clientSecret: { type: "envRef", envName: "MISSING" },
      },
      emptyEnvVars,
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined when the envRef id is missing", () => {
    const result = resolveClientCredentials(
      {
        clientId: { type: "envRef", envName: "MISSING" },
        clientSecret: { type: "literal", value: "secret-xyz" },
      },
      emptyEnvVars,
    );
    expect(result).toBeUndefined();
  });
});
