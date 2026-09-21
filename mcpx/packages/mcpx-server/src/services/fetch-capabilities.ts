import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import { Prompt, PromptMessage } from "@modelcontextprotocol/sdk/types.js";
import { env } from "../env.js";
import {
  ServerCapabilities,
  tagPrompts,
  tagTools,
} from "./capability-registry.js";
import { ExtendedClientI, isMethodNotFoundError } from "./client-extension.js";

// The slice of the extended client the capability fetchers use, so tests can
// supply a fully-typed fake of just these methods.
export type CapabilitySource = Pick<
  ExtendedClientI,
  "listTools" | "listPrompts" | "getPrompt"
>;

// A prompts/list failure is tolerated when tools came back non-empty, so a
// flaky prompts endpoint can't take down an otherwise-usable upstream. With no
// tools either, the failure is surfaced instead of recording an empty server.
export async function fetchServerCapabilities(
  extendedClient: CapabilitySource,
  logger: Logger,
): Promise<ServerCapabilities> {
  // Probe prompts alongside tools but capture the outcome: whether a prompts
  // failure is fatal depends on the tools result, known only after the await.
  const promptsOutcome = fetchPromptCapabilities(extendedClient).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  const tools = await fetchToolCapabilities(extendedClient);
  const prompts = await promptsOutcome;
  if ("error" in prompts) {
    if ((tools.tools ?? []).length === 0) throw prompts.error;
    logger.warn(
      "Failed to load prompts on connect; connecting with tools only",
      {
        error: loggableError(prompts.error),
      },
    );
    return { ...tools };
  }
  return { ...tools, ...prompts.value };
}

// Tolerate MethodNotFound (tools -> []) when prompts are enabled, so a
// prompt-only upstream still connects. Relies on clients being built without
// enforceStrictCapabilities, so tools/list reaches the wire and surfaces the
// server's MethodNotFound here.
export async function fetchToolCapabilities(
  extendedClient: CapabilitySource,
): Promise<Pick<ServerCapabilities, "tools" | "toolParentNames">> {
  const { tools, toolParentNames } = await extendedClient.listTools().then(
    (response) => response,
    (e) => {
      if (env.ENABLE_PROMPT_CAPABILITY && isMethodNotFoundError(e))
        return { tools: [], toolParentNames: {} };
      throw e;
    },
  );
  return {
    tools: tagTools(tools, "upstream"),
    toolParentNames,
  };
}

// MethodNotFound -> no prompt entry, clearing stale prompts when a server stops
// advertising them. Returns nothing when the prompt capability is disabled.
export async function fetchPromptCapabilities(
  extendedClient: CapabilitySource,
): Promise<Pick<ServerCapabilities, "prompts">> {
  if (!env.ENABLE_PROMPT_CAPABILITY) return {};
  const upstreamPrompts = await extendedClient.listPrompts().then(
    ({ prompts }) => prompts,
    (e) => {
      if (isMethodNotFoundError(e)) return [];
      throw e;
    },
  );
  return {
    prompts:
      upstreamPrompts.length > 0
        ? tagPrompts(upstreamPrompts, "upstream")
        : undefined,
  };
}

// Best-effort preview fetch for the system-state UI, keyed by prompt name. A
// prompt that requires arguments fails the empty-args getPrompt and is skipped
// (no entry), so a missing key means "no preview available", not an error.
export async function fetchPromptMessages(
  extendedClient: CapabilitySource,
  prompts: Prompt[],
  logger: Logger,
): Promise<Record<string, PromptMessage[]>> {
  const entries = await Promise.all(
    prompts.map(async (prompt) => {
      const messages = await extendedClient
        .getPrompt({ name: prompt.name, arguments: {} })
        .then((result) => result.messages)
        .catch((e) => {
          logger.debug(
            "getPrompt failed during capability discovery; caching prompt without messages",
            { promptName: prompt.name, error: loggableError(e) },
          );
          return undefined;
        });
      return messages ? ([prompt.name, messages] as const) : undefined;
    }),
  );
  return Object.fromEntries(entries.filter((e) => e !== undefined));
}
