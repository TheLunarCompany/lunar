import { z } from "zod/v4";
import {
  OAuthClientInformationFullSchema,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { webappBoundAckSchema } from "../shared/ack.js";

// ── Shared ────────────────────────────────────────────────────────────────────

export const storedTokensSchema = OAuthTokensSchema.extend({
  expires_at: z.number().optional(),
});

export const tokenDataSchema = z.union([
  storedTokensSchema,
  z.string(),
  OAuthClientInformationFullSchema,
]);

// ── save-oauth-token ──────────────────────────────────────────────────────────

export const saveOAuthTokenPayloadSchema = z.discriminatedUnion("tokenType", [
  z.object({
    serverName: z.string(),
    tokenType: z.literal("tokens"),
    data: storedTokensSchema,
    expiresAt: z.number().optional(),
  }),
  z.object({
    serverName: z.string(),
    tokenType: z.literal("verifier"),
    data: z.string(),
    expiresAt: z.number().optional(),
  }),
  z.object({
    serverName: z.string(),
    tokenType: z.literal("client"),
    data: OAuthClientInformationFullSchema,
    expiresAt: z.number().optional(),
  }),
]);

export const saveOAuthTokenAckSchema = webappBoundAckSchema({});

export type SaveOAuthTokenAck = z.infer<typeof saveOAuthTokenAckSchema>;
export type SaveOAuthTokenPayload = z.infer<typeof saveOAuthTokenPayloadSchema>;

// ── load-oauth-token ──────────────────────────────────────────────────────────

export const loadOAuthTokenPayloadSchema = z.object({
  serverName: z.string(),
  tokenType: z.enum(["tokens", "verifier", "client"]),
});

export const loadOAuthTokenAckSchema = webappBoundAckSchema({
  data: tokenDataSchema.optional(),
});

export type LoadOAuthTokenAck = z.infer<typeof loadOAuthTokenAckSchema>;

// ── delete-oauth-tokens ───────────────────────────────────────────────────────

export const deleteOAuthTokensPayloadSchema = z.object({
  serverName: z.string(),
});

export const deleteOAuthTokensAckSchema = webappBoundAckSchema({});

export type DeleteOAuthTokensAck = z.infer<typeof deleteOAuthTokensAckSchema>;
