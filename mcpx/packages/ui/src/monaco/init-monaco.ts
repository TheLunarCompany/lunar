import { appConfigSchema } from "@mcpx/shared-model";
import { loader as monacoLoader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { configureMonacoYaml } from "monaco-yaml";
import { toJSONSchema } from "zod/v4";
import EditorWorker from "../monaco/editor.worker.js?worker";
import JsonWorker from "../monaco/json.worker.js?worker";

export const initMonaco = () => {
  // Set up workers first
  window.MonacoEnvironment = {
    getWorker(_, label) {
      switch (label) {
        case "editorWorkerService":
          return new EditorWorker();
        case "json":
          return new JsonWorker();
        case "yaml":
          // Use monaco-yaml's worker directly from node_modules
          // This avoids the "Missing requestHandler or method: resetSchema" error
          return new Worker(
            new URL("monaco-yaml/yaml.worker.js", import.meta.url),
            { type: "module" },
          );
        default:
          throw new Error(`Unknown label ${label}`);
      }
    },
  };

  // Configure Monaco YAML after workers are set up
  // Wrap in try-catch to handle any initialization errors gracefully
  try {
    configureMonacoYaml(monaco, {
      enableSchemaRequest: true,
      schemas: [
        {
          fileMatch: ["**/*.yaml", "**/*.yml"],
          schema: toJSONSchema(appConfigSchema),
          uri: "https://docs.lunar.dev/mcpx/app.yaml",
        },
      ],
    });
  } catch (error) {
    // Log but don't throw - YAML editor will still work without schema validation
    console.warn("Monaco YAML configuration warning:", error);
  }

  monacoLoader.config({ monaco });
  monacoLoader.init();
};
