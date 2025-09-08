import express from "express";
import { Logger } from "winston";
import { OAuthSessionManagerI } from "./oauth-session-manager.js";

export function buildOAuthRouter(
  sessionManager: OAuthSessionManagerI,
  logger: Logger,
): express.Router {
  const router = express.Router();

  /**
   * OAuth callback endpoint
   * Handles the authorization code response from OAuth providers
   */
  router.get(
    "/oauth/callback",
    (req: express.Request, res: express.Response) => {
      const { code, state, error } = req.query;

      if (error) {
        logger.error("OAuth callback error", { error, state });
        res
          .status(400)
          .send(
            `OAuth error: ${error}<script>setTimeout(() => window.close(), 2000);</script>`,
          );
        return;
      }

      if (!code || !state) {
        logger.error("OAuth callback missing required parameters", {
          code: !!code,
          state: !!state,
        });
        res
          .status(400)
          .send(
            `Missing required parameters: code and state<script>setTimeout(() => window.close(), 2000);</script>`,
          );
        return;
      }

      // Look up the OAuth flow by state
      const flow = sessionManager.getOAuthFlow(state as string);
      if (!flow) {
        logger.error("OAuth callback with unknown state", { state });
        res
          .status(400)
          .send(
            `Invalid or expired state parameter<script>setTimeout(() => window.close(), 2000);</script>`,
          );
        return;
      }

      // Get the OAuth provider for this flow
      const provider = sessionManager.getOrCreateOAuthProvider(flow.serverName);

      // Pass the authorization code to the provider for token exchange
      provider.completeAuthorization(code as string);

      // Complete the OAuth flow in session manager
      sessionManager.completeOAuthFlow(state as string);

      logger.info("OAuth callback successful", {
        serverName: flow.serverName,
        state,
      });

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
          <p class="info">Server: <code>${flow.serverName}</code></p>
          <script>
            // Auto-close the window after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
    },
  );

  return router;
}
