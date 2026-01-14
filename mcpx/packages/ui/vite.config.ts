/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const getEnvDefaults = () => {
    switch (mode) {
      case "development":
        return {
          VITE_AUTH0_DOMAIN:
            process.env.VITE_AUTH0_DOMAIN ||
            "dev-b8usc66hvtpq73zg.us.auth0.com",
          VITE_AUTH0_CLIENT_ID:
            process.env.VITE_AUTH0_CLIENT_ID ||
            "p9jPXhmCFuZOhrrqNLXiLrFIuPWSSOEO",
          VITE_AUTH0_AUDIENCE: process.env.VITE_AUTH0_AUDIENCE || "mcpx-webapp",
          VITE_ENABLE_ENTERPRISE: process.env.VITE_ENABLE_ENTERPRISE || "false",
          VITE_MCPX_SERVER_URL: process.env.VITE_MCPX_SERVER_URL || undefined,
          VITE_MCPX_SERVER_PORT: process.env.VITE_MCPX_SERVER_PORT || "9000",
          VITE_AUTH_BFF_URL:
            process.env.VITE_AUTH_BFF_URL || "http://localhost:3002",
        };
      case "production":
        return {
          VITE_AUTH0_DOMAIN: process.env.VITE_AUTH0_DOMAIN || "",
          VITE_AUTH0_CLIENT_ID: process.env.VITE_AUTH0_CLIENT_ID || "",
          VITE_AUTH0_AUDIENCE: process.env.VITE_AUTH0_AUDIENCE || "mcpx-webapp",
          VITE_ENABLE_ENTERPRISE: process.env.VITE_ENABLE_ENTERPRISE || "false",
          VITE_MCPX_SERVER_URL: process.env.VITE_MCPX_SERVER_URL || undefined,
          VITE_MCPX_SERVER_PORT: process.env.VITE_MCPX_SERVER_PORT || "9000",
          VITE_AUTH_BFF_URL: process.env.VITE_AUTH_BFF_URL || "",
        };
      default:
        return {
          VITE_AUTH0_DOMAIN:
            process.env.VITE_AUTH0_DOMAIN ||
            "dev-b8usc66hvtpq73zg.us.auth0.com",
          VITE_AUTH0_CLIENT_ID:
            process.env.VITE_AUTH0_CLIENT_ID ||
            "p9jPXhmCFuZOhrrqNLXiLrFIuPWSSOEO",
          VITE_AUTH0_AUDIENCE: process.env.VITE_AUTH0_AUDIENCE || "mcpx-webapp",
          VITE_ENABLE_ENTERPRISE: process.env.VITE_ENABLE_ENTERPRISE || "false",
          VITE_MCPX_SERVER_URL: process.env.VITE_MCPX_SERVER_URL || undefined,
          VITE_MCPX_SERVER_PORT: process.env.VITE_MCPX_SERVER_PORT || "9000",
          VITE_AUTH_BFF_URL:
            process.env.VITE_AUTH_BFF_URL || "http://localhost:3002",
        };
    }
  };

  const envDefaults = getEnvDefaults();

  return {
    plugins: [react(), svgr()],
    test: {
      globals: true,
      environment: "happy-dom",
      setupFiles: "./src/test/setup.ts",
      css: false,
      threads: false,
      include: ["src/**/*.test.{ts,tsx}"], // Only look for .test.ts files in src
      exclude: ["e2e/**/*", "node_modules/**/*"], // ignore e2e
    },
    server: {
      allowedHosts: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx", ".json"],
    },
    build: {
      commonjsOptions: {
        include: [/shared-model/, /node_modules/],
      },
    },
    optimizeDeps: {
      include: [
        "@mcpx/shared-model",
        "monaco-yaml/yaml.worker.js",
        "monaco-editor/esm/vs/editor/editor.worker.js",
        "monaco-editor/esm/vs/language/json/json.worker.js",
      ],
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    define: {
      __DEV__: mode === "development",
      __STAGING__: mode === "staging",
      __PROD__: mode === "production",

      "import.meta.env.VITE_AUTH0_DOMAIN": JSON.stringify(
        env.VITE_AUTH0_DOMAIN || envDefaults.VITE_AUTH0_DOMAIN,
      ),
      "import.meta.env.VITE_AUTH0_CLIENT_ID": JSON.stringify(
        env.VITE_AUTH0_CLIENT_ID || envDefaults.VITE_AUTH0_CLIENT_ID,
      ),
      "import.meta.env.VITE_AUTH0_AUDIENCE": JSON.stringify(
        env.VITE_AUTH0_AUDIENCE || envDefaults.VITE_AUTH0_AUDIENCE,
      ),
      "import.meta.env.VITE_ENABLE_ENTERPRISE": JSON.stringify(
        env.VITE_ENABLE_ENTERPRISE || envDefaults.VITE_ENABLE_ENTERPRISE,
      ),
      "import.meta.env.VITE_MCPX_SERVER_URL": JSON.stringify(
        env.VITE_MCPX_SERVER_URL || envDefaults.VITE_MCPX_SERVER_URL,
      ),
      "import.meta.env.VITE_MCPX_SERVER_PORT": JSON.stringify(
        env.VITE_MCPX_SERVER_PORT || envDefaults.VITE_MCPX_SERVER_PORT,
      ),
      "import.meta.env.VITE_WS_URL": JSON.stringify(
        env.VITE_WS_URL || undefined,
      ),
      "import.meta.env.VITE_OAUTH_CALLBACK_BASE_URL": JSON.stringify(
        env.VITE_OAUTH_CALLBACK_BASE_URL || undefined,
      ),
      "import.meta.env.VITE_AUTH_BFF_URL": JSON.stringify(
        env.VITE_AUTH_BFF_URL || envDefaults.VITE_AUTH_BFF_URL,
      ),
    },
  };
});
