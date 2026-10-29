import { describe, it, expect } from "@jest/globals";
import { WebappBoundPayloadOf } from "@mcpx/webapp-protocol/messages";
import {
  fitUsageStatsToBudget,
  TrimmedUsageStats,
  UsageStatsFit,
} from "./usage-stats-budget.js";

type UsageStatsPayload = WebappBoundPayloadOf<"usage-stats">;
type ToolEntry = NonNullable<
  UsageStatsPayload["targetServers"][number]["tools"]
>[string];

const jsonBytes = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value));

const textBytes = (text: string): number => jsonBytes(text) - 2;

const tool = (description: string): ToolEntry => ({
  description,
  isCustom: false,
  usage: { callCount: 1 },
});

const payloadWithTools = (
  tools: Record<string, ToolEntry>,
): UsageStatsPayload => ({
  agents: [],
  targetServers: [
    { name: "server", type: "streamable-http", status: "connected", tools },
  ],
});

const toolsOf = (payload: UsageStatsPayload): Record<string, ToolEntry> =>
  payload.targetServers[0]?.tools ?? {};

const trimmedFit = (fit: UsageStatsFit): TrimmedUsageStats => {
  if (fit.outcome !== "trimmed") {
    throw new Error(`Expected a trimmed fit, got ${fit.outcome}`);
  }
  return fit;
};

const sentPayload = (fit: UsageStatsFit): UsageStatsPayload => {
  if (fit.outcome === "too-big") {
    throw new Error("Expected a payload to send, got too-big");
  }
  return fit.payload;
};

const hasLoneSurrogate = (text: string): boolean =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
    text,
  );

describe("fitUsageStatsToBudget", () => {
  it("returns a payload within budget untouched", () => {
    const payload = payloadWithTools({ a: tool("short") });

    const fit = fitUsageStatsToBudget({ payload, budgetBytes: 10_000 });

    expect(fit).toEqual({ outcome: "untouched", payload });
    expect(sentPayload(fit)).toBe(payload);
  });

  it("cuts only the long texts, to one shared cap, and keeps short ones whole", () => {
    const payload = payloadWithTools({
      short: tool("s".repeat(10)),
      longA: tool("a".repeat(5_000)),
      longB: tool("b".repeat(8_000)),
    });
    const budgetBytes = jsonBytes(payload) - 10_000;

    const fit = trimmedFit(fitUsageStatsToBudget({ payload, budgetBytes }));

    // Text budget 3,010: the short text keeps its 10, the two long ones split 3,000.
    const tools = toolsOf(fit.payload);
    expect(tools["short"]?.description).toBe("s".repeat(10));
    expect(tools["longA"]?.description).toBe(`${"a".repeat(1_497)}…`);
    expect(tools["longB"]?.description).toBe(`${"b".repeat(1_497)}…`);
    expect(tools["longA"]?.usage.callCount).toBe(1);
    expect(fit.textCut).toEqual({ capBytes: 1_500, count: 2 });
    expect(fit.emptiedServers).toEqual([]);
    expect(fit.bytes).toBe(jsonBytes(fit.payload));
    expect(fit.bytes).toBeLessThanOrEqual(budgetBytes);
  });

  it("trims parameter, prompt, argument and prompt message texts too", () => {
    const long = "x".repeat(5_000);
    const payload: UsageStatsPayload = {
      agents: [],
      targetServers: [
        {
          name: "server",
          type: "stdio",
          status: "connected",
          tools: {
            t: {
              ...tool("short"),
              parameters: [{ name: "p", description: long }],
            },
          },
          prompts: {
            pr: {
              description: long,
              arguments: [{ name: "arg", description: long }],
              messages: [
                { role: "user", content: { type: "text", text: long } },
              ],
              usage: { callCount: 0 },
            },
          },
        },
      ],
    };
    const budgetBytes = jsonBytes(payload) - 10_000;

    const fit = trimmedFit(fitUsageStatsToBudget({ payload, budgetBytes }));

    const server = fit.payload.targetServers[0];
    const prompt = server?.prompts?.["pr"];
    const trimmedTexts = [
      server?.tools?.["t"]?.parameters?.[0]?.description,
      prompt?.description,
      prompt?.arguments?.[0]?.description,
      prompt?.messages?.[0]?.content.text,
    ];
    trimmedTexts.forEach((text) => {
      expect(text?.endsWith("…")).toBe(true);
      expect(text?.length).toBeLessThan(long.length);
    });
    expect(server?.tools?.["t"]?.description).toBe("short");
    expect(fit.textCut?.count).toBe(4);
    expect(fit.bytes).toBeLessThanOrEqual(budgetBytes);
  });

  it("measures UTF-8 bytes after JSON escaping, and never splits a character", () => {
    const tricky = 'quote" back\\ nl\n tab\t ctl\u0001 é 中 😀 '.repeat(400);
    const payload = payloadWithTools({
      a: tool(tricky),
      b: tool(`${tricky}more`),
    });
    const budgetBytes = jsonBytes(payload) - 15_000;

    const fit = trimmedFit(fitUsageStatsToBudget({ payload, budgetBytes }));

    const descriptions = Object.values(toolsOf(fit.payload)).map(
      (entry) => entry.description ?? "",
    );
    descriptions.forEach((description) => {
      expect(description.endsWith("…")).toBe(true);
      expect(hasLoneSurrogate(description)).toBe(false);
    });
    expect(fit.bytes).toBeLessThanOrEqual(budgetBytes);
  });

  it("empties the biggest server's tools and prompts when names alone don't fit", () => {
    const manyTools = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`tool-${i}`, tool("")]),
    );
    const payload: UsageStatsPayload = {
      agents: [],
      targetServers: [
        {
          name: "small",
          type: "stdio",
          status: "connected",
          tools: { only: tool("kept") },
        },
        {
          name: "big",
          type: "streamable-http",
          status: "connected",
          tools: manyTools,
        },
      ],
    };
    const budgetBytes = jsonBytes(payload) - 1_000;

    const fit = trimmedFit(fitUsageStatsToBudget({ payload, budgetBytes }));

    expect(fit.emptiedServers).toEqual(["big"]);
    expect(fit.payload.targetServers[1]).toMatchObject({
      name: "big",
      status: "connected",
      tools: {},
      prompts: {},
    });
    expect(fit.payload.targetServers[0]?.tools?.["only"]?.description).toBe(
      "kept",
    );
    expect(fit.textCut).toBeNull();
    expect(fit.bytes).toBeLessThanOrEqual(budgetBytes);
  });

  it("gives no payload to send when it can't fit even with every server emptied", () => {
    const payload: UsageStatsPayload = {
      agents: [{ clientInfo: { name: "a".repeat(2_000) } }],
      targetServers: [
        {
          name: "server",
          type: "stdio",
          status: "connected",
          tools: { t: tool("x") },
        },
      ],
    };

    const fit = fitUsageStatsToBudget({ payload, budgetBytes: 1_000 });

    expect(fit).toMatchObject({
      outcome: "too-big",
      emptiedServers: ["server"],
    });
    expect(fit).not.toHaveProperty("payload");
  });
});

describe("fitUsageStatsToBudget cutting a single text", () => {
  const mixed = 'a"b\\c\nd\u0001é中😀z';
  const codePoints = Array.from(mixed);
  const payload = payloadWithTools({ only: tool(mixed) });
  // With one text, the cap is exactly the bytes the budget leaves for it.
  const fixedBytes = jsonBytes(payload) - textBytes(mixed);
  const descriptionWithin = (maxBytes: number): string =>
    toolsOf(
      sentPayload(
        fitUsageStatsToBudget({ payload, budgetBytes: fixedBytes + maxBytes }),
      ),
    )["only"]?.description ?? "";

  it("keeps the longest whole-character prefix that fits, at every size", () => {
    Array.from(
      { length: textBytes(mixed) + 2 },
      (_, maxBytes) => maxBytes,
    ).forEach((maxBytes) => {
      const truncated = descriptionWithin(maxBytes);
      if (truncated === mixed) {
        expect(textBytes(mixed)).toBeLessThanOrEqual(maxBytes);
        return;
      }
      expect(textBytes(truncated)).toBeLessThanOrEqual(maxBytes);
      expect(hasLoneSurrogate(truncated)).toBe(false);
      if (truncated === "") return;
      const kept = Array.from(truncated.slice(0, -1)).length;
      const nextLonger = `${codePoints.slice(0, kept + 1).join("")}…`;
      expect(textBytes(nextLonger)).toBeGreaterThan(maxBytes);
    });
  });

  it("leaves an empty text when not even the marker fits", () => {
    expect(descriptionWithin(2)).toBe("");
  });
});
