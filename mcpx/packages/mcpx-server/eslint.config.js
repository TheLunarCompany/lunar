import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import * as jestPlugin from "eslint-plugin-jest";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { project: true },
    },
  },
  {
    rules: {
      "@typescript-eslint/explicit-function-return-type": "warn",
      // allowing only for `_` to be an unused var
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false } },
      ],
    },
  },

  /* 4. **tests override**: loosen rules only for tests */
  {
    files: [
      "**/*.test.{ts,js}",
      "**/__tests__/**/*.{ts,js}",
      "**/it/**/*.{ts,js}",
    ],
    plugins: { jest: jestPlugin },
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off", // let tests omit return types
      "@typescript-eslint/no-misused-promises": "off", // async helpers often push void
      "@typescript-eslint/no-explicit-any": "off", // quick stubs are fine in tests
    },
  },

  globalIgnores([
    "./lunar-interceptor.ts",
    "./eslint.config.js",
    "./jest.config.cjs",
    "./loader.mjs",
    "./dist",
  ]),
  tseslint.configs.recommended,
]);
