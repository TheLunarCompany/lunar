import fs from "fs";
import { parse } from "yaml";
import { Config, configSchema } from "./model.js";
import { SafeParseReturnType } from "zod";

const CONFIG_PATH = process.env["APP_CONFIG_PATH"] || "config/app.yaml";
const DEFAULT_CONFIG = {
  permissions: {
    base: "allow" as const,
    consumers: {},
  },
  toolGroups: [],
};

export function loadConfig(): SafeParseReturnType<unknown, Config | undefined> {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: true, data: DEFAULT_CONFIG };
  }
  const rawConfig = fs.readFileSync(CONFIG_PATH, "utf8");
  const configObj = parse(rawConfig);
  if (!configObj) {
    return { success: true, data: DEFAULT_CONFIG };
  }
  return configSchema.safeParse(configObj);
}
