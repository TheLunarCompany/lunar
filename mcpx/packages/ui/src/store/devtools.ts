import type { DevtoolsOptions } from "zustand/middleware";

export function createDevtoolsOptions(name: string): DevtoolsOptions {
  return { name, store: name, enabled: true };
}
