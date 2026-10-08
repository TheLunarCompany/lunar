// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { uiReviewRules } from "../../../eslint.review-rules.js";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "e2e/**",
      "storybook-static/**",
      "*.config.ts",
      "*.config.js",
      "*.config.cjs",
      "env.d.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "public/mockServiceWorker.js",
    ],
  },
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  // TypeScript files with type-aware linting
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { react: { version: "18.3" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
      "react/jsx-no-target-blank": "off",
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true },
      ],
      "react/prop-types": "off",
      // Disabled: return types are inferrable and this is a React app
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: true,
          considerDefaultExhaustiveForUnions: true,
        },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
      // React-specific: disable unescaped entities rule as it's too strict for JSX
      "react/no-unescaped-entities": "off",
      // Allow empty interfaces that extend other interfaces (common in React prop patterns)
      "@typescript-eslint/no-empty-object-type": "off",
    },
  }, // Allow non-component exports in component files (shadcn/ui variants, column definitions, validators)
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/tools/ToolGroupSheet.tsx",
      "src/components/tools/ToolsTable.tsx",
      "src/stories/**/*.{ts,tsx}",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  ...uiReviewRules,
  // JavaScript files (legacy shadcn/ui components)
  {
    files: ["**/*.{js,jsx}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    settings: { react: { version: "18.3" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
      "react/jsx-no-target-blank": "off",
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true },
      ],
      // Disable prop-types for JSX files - this is a TypeScript project
      // and JSX files are legacy shadcn/ui components
      "react/prop-types": "off",
    },
  },
  storybook.configs["flat/recommended"],
  {
    files: [
      "**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)",
      "**/*.story.@(ts|tsx|js|jsx|mjs|cjs)",
    ],
    rules: {
      "storybook/hierarchy-separator": "error",
      "storybook/no-redundant-story-name": "error",
      "storybook/prefer-pascal-case": "error",
    },
  },
);
