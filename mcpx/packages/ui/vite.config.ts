import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
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
    include: ["@mcpx/shared-model"],
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
});
