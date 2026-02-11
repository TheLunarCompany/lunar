import { loggableError } from "@mcpx/toolkit-core/logging";
import express from "express";
import { Logger } from "winston";
import { z } from "zod/v4";
import { UpstreamHandler } from "../services/upstream-handler.js";

const OAuthCallbackQuerySchema = z.looseObject({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export function buildOAuthRouter(
  upstreamHandler: UpstreamHandler,
  logger: Logger,
): express.Router {
  const router = express.Router();

  /**
   * OAuth callback endpoint
   * Handles the authorization code response from OAuth providers
   */
  router.get(
    "/oauth/callback",
    async (req: express.Request, res: express.Response) => {
      const parseResult = OAuthCallbackQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        logger.error("OAuth callback failed to parse query", {
          errors: z.treeifyError(parseResult.error),
        });
        res.status(400).send("Invalid query parameters");
        return;
      }

      const { code, state, error } = parseResult.data;

      if (error) {
        logger.error("OAuth callback error from provider", { error, state });
        res.status(400).send(`OAuth error: ${error}`);
        return;
      }

      if (!code || !state) {
        logger.error("OAuth callback missing required parameters", {
          hasCode: !!code,
          hasState: !!state,
        });
        res.status(400).send("Missing required parameters: code and state");
        return;
      }

      try {
        await upstreamHandler.completeOAuthByState(state, code);

        logger.info("OAuth callback successful", { state });

        res.send(`
      <html>
        <head>
          <title>OAuth Authorization Complete</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; }
            .info { color: #6c757d; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Authorization Complete</h1>
          <p class="info">You may now close this window and return to your application.</p>
        </body>
      </html>
    `);
      } catch (err) {
        logger.error("OAuth callback failed to complete connection", {
          state,
          error: loggableError(err),
        });
        res.status(500).send(`
      <html>
        <head>
          <title>OAuth Authorization Failed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #dc3545; }
            .info { color: #6c757d; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Authorization Failed</h1>
          <p class="info">Failed to complete the connection. Please try again.</p>
        </body>
      </html>
    `);
      }
    },
  );

  return router;
}
