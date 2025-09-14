import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const getEnvDefaults = () => {
    switch (mode) {
      case "development":
        return {
          VITE_AUTH0_DOMAIN: "dev-b8usc66hvtpq73zg.us.auth0.com",
          VITE_AUTH0_CLIENT_ID: "p9jPXhmCFuZOhrrqNLXiLrFIuPWSSOEO",
          VITE_AUTH0_AUDIENCE: "mcpx-webapp",
          VITE_ENABLE_LOGIN: "false",
        };
      case "production":
        return {
          VITE_AUTH0_DOMAIN: "",
          VITE_AUTH0_CLIENT_ID: "",
          VITE_AUTH0_AUDIENCE: "mcpx-webapp",
          VITE_ENABLE_LOGIN: "false",
        };
      default:
        return {
          VITE_AUTH0_DOMAIN: "dev-b8usc66hvtpq73zg.us.auth0.com",
          VITE_AUTH0_CLIENT_ID: "p9jPXhmCFuZOhrrqNLXiLrFIuPWSSOEO",
          VITE_AUTH0_AUDIENCE: "mcpx-webapp",
          VITE_ENABLE_LOGIN: "false",
        };
    }
  };

  const envDefaults = getEnvDefaults();

  return {
    plugins: [react()],
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
      "import.meta.env.VITE_ENABLE_LOGIN": JSON.stringify(
        env.VITE_ENABLE_LOGIN || envDefaults.VITE_ENABLE_LOGIN,
      ),
    },
  };
});
