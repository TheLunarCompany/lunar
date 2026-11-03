import { mapValues } from "@aigw/core/data";
import { WebappBoundPayloadOf } from "@mcpx/webapp-protocol/messages";

type UsageStatsPayload = WebappBoundPayloadOf<"usage-stats">;
type UsageStatsServer = UsageStatsPayload["targetServers"][number];

interface UntouchedUsageStats {
  outcome: "untouched";
  payload: UsageStatsPayload;
}

export interface TrimmedUsageStats {
  outcome: "trimmed";
  payload: UsageStatsPayload;
  originalBytes: number;
  bytes: number;
  textCut: { capBytes: number; count: number } | null;
  emptiedServers: string[];
}

interface TooBigUsageStats {
  outcome: "too-big";
  originalBytes: number;
  bytes: number;
  emptiedServers: string[];
}

export type UsageStatsFit =
  | UntouchedUsageStats
  | TrimmedUsageStats
  | TooBigUsageStats;

const TRUNCATION_MARKER = "…";
const TRUNCATION_MARKER_BYTES = Buffer.byteLength(TRUNCATION_MARKER);
// Array.from yields a half of a surrogate pair only when its other half is missing.
const LONE_SURROGATE = /^[\uD800-\uDFFF]$/;

// Cuts every free text to one shared byte cap; if that can't fit, empties the biggest servers.
export function fitUsageStatsToBudget(params: {
  payload: UsageStatsPayload;
  budgetBytes: number;
}): UsageStatsFit {
  const { payload, budgetBytes } = params;
  const originalBytes = jsonBytes(payload);
  if (originalBytes <= budgetBytes) {
    return { outcome: "untouched", payload };
  }
  return fitByTrimming({
    payload,
    budgetBytes,
    originalBytes,
    emptiedServers: [],
  });
}

function fitByTrimming(params: {
  payload: UsageStatsPayload;
  budgetBytes: number;
  originalBytes: number;
  emptiedServers: string[];
}): UsageStatsFit {
  const { payload, budgetBytes, originalBytes, emptiedServers } = params;
  const textSizes = textsOf(payload).map(textBytes);
  // Everything that isn't free text: keys, names, numbers, and the texts' own quotes.
  const fixedBytes = jsonBytes(payload) - sum(textSizes);
  const textBudget = budgetBytes - fixedBytes;

  if (textBudget < 0) {
    const biggest = biggestServerWithCapabilities(payload);
    if (biggest === undefined) {
      return {
        outcome: "too-big",
        originalBytes,
        bytes: jsonBytes(payload),
        emptiedServers,
      };
    }
    return fitByTrimming({
      payload: withoutCapabilities({ payload, serverName: biggest }),
      budgetBytes,
      originalBytes,
      emptiedServers: [...emptiedServers, biggest],
    });
  }

  const cap = waterLevel({ sizes: textSizes, budget: textBudget });
  const trimmed = mapTexts(payload, (text) =>
    truncateToBytes({ text, maxBytes: cap }),
  );
  return {
    outcome: "trimmed",
    payload: trimmed,
    originalBytes,
    bytes: jsonBytes(trimmed),
    textCut: Number.isFinite(cap)
      ? { capBytes: cap, count: textSizes.filter((size) => size > cap).length }
      : null,
    emptiedServers,
  };
}

// Largest cap such that all texts, each cut to at most cap bytes, add up to at most budget.
function waterLevel(params: { sizes: number[]; budget: number }): number {
  const { sizes, budget } = params;
  const ascending = [...sizes].sort((a, b) => a - b);
  const level = ascending.reduce<{ remaining: number; cap?: number }>(
    (acc, size, index) => {
      if (acc.cap !== undefined) return acc;
      // What's left, split evenly between this text and every longer one.
      const share = Math.floor(acc.remaining / (ascending.length - index));
      return size <= share
        ? { remaining: acc.remaining - size }
        : { remaining: acc.remaining, cap: share };
    },
    { remaining: budget },
  );
  return level.cap ?? Number.POSITIVE_INFINITY;
}

function truncateToBytes(params: { text: string; maxBytes: number }): string {
  const { text, maxBytes } = params;
  if (textBytes(text) <= maxBytes) return text;
  const room = maxBytes - TRUNCATION_MARKER_BYTES;
  if (room <= 0) return "";
  // Each code unit costs at least a byte, so no fitting prefix is longer than room.
  const kept = Array.from(text.slice(0, room)).reduce(
    (acc, char) => {
      if (acc.full) return acc;
      const bytes = acc.bytes + charBytes(char);
      return bytes > room
        ? { ...acc, full: true }
        : { bytes, length: acc.length + char.length, full: false };
    },
    { bytes: 0, length: 0, full: false },
  );
  return `${text.slice(0, kept.length)}${TRUNCATION_MARKER}`;
}

// A lone surrogate never fits, so a cut never keeps half of a pair.
function charBytes(char: string): number {
  return LONE_SURROGATE.test(char) ? Number.POSITIVE_INFINITY : textBytes(char);
}

// Spells out every free-text field by hand: a generic walk over "description"/"text" keys
// would be shorter but can't return a typed payload without a cast.
function mapTexts(
  payload: UsageStatsPayload,
  transform: (text: string) => string,
): UsageStatsPayload {
  const mapText = (text: string | undefined): string | undefined =>
    text === undefined ? undefined : transform(text);
  return {
    ...payload,
    targetServers: payload.targetServers.map((server) => ({
      ...server,
      tools:
        server.tools &&
        mapValues(server.tools, (tool) => ({
          ...tool,
          description: mapText(tool.description),
          parameters: tool.parameters?.map((parameter) => ({
            ...parameter,
            description: mapText(parameter.description),
          })),
        })),
      prompts:
        server.prompts &&
        mapValues(server.prompts, (prompt) => ({
          ...prompt,
          description: mapText(prompt.description),
          arguments: prompt.arguments?.map((argument) => ({
            ...argument,
            description: mapText(argument.description),
          })),
          messages: prompt.messages?.map((message) => ({
            ...message,
            content: {
              ...message.content,
              text: mapText(message.content.text),
            },
          })),
        })),
    })),
  };
}

// Reuses mapTexts' walk so the list of free-text fields lives in one place.
function textsOf(payload: UsageStatsPayload): string[] {
  const texts: string[] = [];
  mapTexts(payload, (text) => {
    texts.push(text);
    return text;
  });
  return texts;
}

function biggestServerWithCapabilities(
  payload: UsageStatsPayload,
): string | undefined {
  const [biggest] = payload.targetServers
    // Only servers with something left to drop, so the recursion always ends.
    .filter(hasCapabilities)
    .map((server) => ({ name: server.name, bytes: jsonBytes(server) }))
    .sort((a, b) => b.bytes - a.bytes);
  return biggest?.name;
}

function hasCapabilities(server: UsageStatsServer): boolean {
  return (
    Object.keys(server.tools ?? {}).length > 0 ||
    Object.keys(server.prompts ?? {}).length > 0
  );
}

function withoutCapabilities(params: {
  payload: UsageStatsPayload;
  serverName: string;
}): UsageStatsPayload {
  const { payload, serverName } = params;
  return {
    ...payload,
    targetServers: payload.targetServers.map((server) =>
      server.name === serverName
        ? { ...server, tools: {}, prompts: {} }
        : server,
    ),
  };
}

// Minus the two quotes JSON wraps a string in.
function textBytes(text: string): number {
  return jsonBytes(text) - 2;
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
