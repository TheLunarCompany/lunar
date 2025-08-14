import { nextVersionAppConfigSchema as appConfigSchema } from "@mcpx/shared-model";
import { loader as monacoLoader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { configureMonacoYaml } from "monaco-yaml";
import { toJSONSchema } from "zod/v4";
import EditorWorker from "../monaco/editor.worker.js?worker";
import JsonWorker from "../monaco/json.worker.js?worker";
import YamlWorker from "../monaco/yaml.worker.js?worker";

export const initMonaco = () => {
  window.MonacoEnvironment = {
    getWorker(_, label) {
      switch (label) {
        case "editorWorkerService":
          return new EditorWorker();
        case "json":
          return new JsonWorker();
        case "yaml":
          return new YamlWorker();
        default:
          throw new Error(`Unknown label ${label}`);
      }
    },
  };

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

  monacoLoader.config({ monaco });
  monacoLoader.init();
};
