import { loggableError } from "@aigw/core/logging";
import express from "express";
import { Logger } from "winston";
import { z } from "zod/v4";
import { UpstreamHandler } from "../services/upstream-handler.js";

const OAuthCallbackQuerySchema = z.looseObject({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

function callbackPage(options: {
  title: string;
  heading: string;
  type: "error" | "info";
  message: string;
}): string {
  return `
      <html>
        <head>
          <title>${options.title}</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #dc3545; }
            .info { color: #6c757d; }
          </style>
        </head>
        <body>
          <h1 class="${options.type}">${options.heading}</h1>
          <p class="info">${options.message}</p>
        </body>
      </html>
    `;
}

export function buildOAuthRouter(
  upstreamHandler: Pick<UpstreamHandler, "completeOAuthByState">,
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
      const requestContext = {
        secFetchSite: req.get("Sec-Fetch-Site"),
        secFetchUser: req.get("Sec-Fetch-User"),
        userAgent: req.get("User-Agent"),
      };
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
        const outcome = await upstreamHandler.completeOAuthByState(state, code);

        if (outcome === "unknown-state") {
          logger.warn("OAuth callback for unknown state", {
            state,
            ...requestContext,
          });
          res.status(404).send(
            callbackPage({
              title: "This sign-in link is no longer active",
              heading: "This sign-in link is no longer active",
              type: "info",
              message:
                "If you just signed in, you're all set. You can close this window.",
            }),
          );
          return;
        }

        logger.info("OAuth callback successful", { state, ...requestContext });

        res.send(`
      <html>
        <head>
          <title>OAuth Authorization Complete</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; }
            .info { color: #6c757d; }
          </style>
          <script>
            let secondsRemaining = 5;

            window.addEventListener("DOMContentLoaded", () => {
              const countdownElement = document.getElementById("countdown");
              if (!countdownElement) {
                return;
              }

              const intervalId = window.setInterval(() => {
                secondsRemaining -= 1;
                if (secondsRemaining <= 0) {
                  countdownElement.textContent = "0";
                  window.clearInterval(intervalId);
                  window.close();
                  return;
                }

                countdownElement.textContent = String(secondsRemaining);
              }, 1000);
            });
          </script>
        </head>
        <body>
          <h1 class="success">✅ Authorization Complete</h1>
          <p class="info">You may now close this window and return to your application.</p>
          <p class="info">This window will close automatically in <span id="countdown">5</span> seconds.</p>
        </body>
      </html>
    `);
      } catch (err) {
        logger.error("OAuth callback failed to complete connection", {
          state,
          ...requestContext,
          error: loggableError(err),
        });
        res.status(500).send(
          callbackPage({
            title: "OAuth Authorization Failed",
            heading: "❌ Authorization Failed",
            type: "error",
            message: "Failed to complete the connection. Please try again.",
          }),
        );
      }
    },
  );

  return router;
}
