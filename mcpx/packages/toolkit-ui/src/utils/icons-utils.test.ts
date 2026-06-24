import {
  getAgentIconEntry,
  getAgentIconUrl,
  matchRegistryKey,
  lookupRegistryKey,
  extractPrefix,
} from "./icons-utils.js";
import { SERVER_ICON_REGISTRY } from "./icons-constants.js";

describe("getAgentIconEntry", () => {
  it("Cursor", () => {
    const expected = {
      key: "cursor",
      entry: { kind: "custom", iconifyId: "simple-icons:cursor" },
    };
    expect(getAgentIconEntry("Cursor")).toEqual(expected);
    expect(getAgentIconEntry("cursor")).toEqual(expected);
  });

  it("VSCode", () => {
    const entry = { kind: "custom", iconifyId: "logos:visual-studio-code" };
    const vscodeExpected = { key: "vscode", entry };
    expect(getAgentIconEntry("VSCode")).toEqual(vscodeExpected);
    expect(getAgentIconEntry("vscode")).toEqual(vscodeExpected);
    expect(getAgentIconEntry("vs-code")).toEqual(vscodeExpected);
    expect(getAgentIconEntry("vs code")).toEqual(vscodeExpected);
    expect(getAgentIconEntry("visual studio code")).toEqual({
      key: "visual studio code",
      entry,
    });
  });

  it("Claude Code", () => {
    const expected = {
      key: "claudecode",
      entry: {
        kind: "custom",
        iconifyId: "cbi:claude-clawd",
        color: "#d97757",
      },
    };
    expect(getAgentIconEntry("Claude Code")).toEqual(expected);
    expect(getAgentIconEntry("claude-code")).toEqual(expected);
    expect(getAgentIconEntry("claude code")).toEqual(expected);
  });

  it("Claude Desktop", () => {
    const entry = { kind: "custom", iconifyId: "logos:claude-icon" };
    expect(getAgentIconEntry("Claude Desktop")).toEqual({
      key: "claudedesktop",
      entry,
    });
    expect(getAgentIconEntry("claude")).toEqual({ key: "claude", entry });
    expect(getAgentIconEntry("anthropic")).toEqual({ key: "anthropic", entry });
  });

  it("Copilot", () => {
    const expected = {
      key: "copilot",
      entry: { kind: "custom", iconifyId: "logos:github-copilot" },
    };
    expect(getAgentIconEntry("Copilot")).toEqual(expected);
    expect(getAgentIconEntry("copilot")).toEqual(expected);
  });

  it("ChatGPT", () => {
    const entry = { kind: "custom", iconifyId: "simple-icons:openai" };
    expect(getAgentIconEntry("ChatGPT")).toEqual({ key: "chatgpt", entry });
    expect(getAgentIconEntry("chatgpt")).toEqual({ key: "chatgpt", entry });
    expect(getAgentIconEntry("openai")).toEqual({ key: "openai", entry });
  });

  it("Codex", () => {
    const expected = { key: "codex", entry: { kind: "local" } };
    expect(getAgentIconEntry("Codex")).toEqual(expected);
    expect(getAgentIconEntry("codex")).toEqual(expected);
    expect(getAgentIconEntry("codex-mcp-client")).toEqual(expected);
  });

  it("Warp", () => {
    const expected = {
      key: "warp",
      entry: { kind: "custom", iconifyId: "simple-icons:warp" },
    };
    expect(getAgentIconEntry("Warp")).toEqual(expected);
    expect(getAgentIconEntry("warp")).toEqual(expected);
  });

  it("Windsurf", () => {
    const expected = {
      key: "windsurf",
      entry: {
        kind: "custom",
        iconifyId: "simple-icons:windsurf",
        color: "#00BFA5",
      },
    };
    expect(getAgentIconEntry("Windsurf")).toEqual(expected);
    expect(getAgentIconEntry("windsurf")).toEqual(expected);
  });

  it("N8N", () => {
    const expected = {
      key: "n8n",
      entry: {
        kind: "custom",
        iconifyId: "simple-icons:n8n",
        color: "#EA4B71",
      },
    };
    expect(getAgentIconEntry("N8N")).toEqual(expected);
    expect(getAgentIconEntry("n8n")).toEqual(expected);
  });

  it("Inspector", () => {
    const expected = {
      key: "inspector",
      entry: {
        kind: "custom",
        iconifyId: "hugeicons:mcp-server",
        color: "#5147E4",
      },
    };
    expect(getAgentIconEntry("Inspector")).toEqual(expected);
    expect(getAgentIconEntry("inspector")).toEqual(expected);
  });

  it("Gemini CLI", () => {
    const expected = { key: "geminicli", entry: { kind: "local" } };
    expect(getAgentIconEntry("Gemini CLI")).toEqual(expected);
    expect(getAgentIconEntry("gemini-cli")).toEqual(expected);
    expect(getAgentIconEntry("geminicli")).toEqual(expected);
    expect(getAgentIconEntry("gemini")).toBeNull();
  });

  it("OpenCode", () => {
    const expected = {
      key: "opencode",
      entry: { kind: "custom", iconifyId: "simple-icons:opencode" },
    };
    expect(getAgentIconEntry("OpenCode")).toEqual(expected);
    expect(getAgentIconEntry("opencode")).toEqual(expected);
  });

  it("Lunar orbiter", () => {
    const expected = {
      key: "lunarorbiter",
      entry: {
        kind: "custom",
        iconifyId: "majesticons:planet-rocket-line",
        color: "#5147E4",
      },
    };
    expect(getAgentIconEntry("Lunar orbiter")).toEqual(expected);
  });

  it("returns null for unknown agent", () => {
    expect(getAgentIconEntry("unknown-agent")).toBeNull();
  });
});

describe("matchRegistryKey", () => {
  const serverKeys = Object.keys(SERVER_ICON_REGISTRY);

  it("exact match", () => {
    expect(matchRegistryKey("slack", serverKeys)).toBe("slack");
    expect(matchRegistryKey("github", serverKeys)).toBe("github");
  });

  it("case-insensitive match", () => {
    expect(matchRegistryKey("Slack", serverKeys)).toBe("slack");
    expect(matchRegistryKey("SLACK", serverKeys)).toBe("slack");
    expect(matchRegistryKey("GitHub", serverKeys)).toBe("github");
  });

  it("token scan: key at first position", () => {
    expect(matchRegistryKey("github-mcp", serverKeys)).toBe("github");
    expect(matchRegistryKey("slack_internal", serverKeys)).toBe("slack");
  });

  it("token scan: key not at first position", () => {
    expect(matchRegistryKey("test_for-notion", serverKeys)).toBe("notion");
    expect(matchRegistryKey("internal-slack-server", serverKeys)).toBe("slack");
  });

  it("token scan: multiple matches — longest key wins", () => {
    expect(matchRegistryKey("slack-n8n-connector", serverKeys)).toBe("slack");
  });

  it("substring: no-separator concatenation", () => {
    expect(matchRegistryKey("notionmcp", serverKeys)).toBe("notion");
    expect(matchRegistryKey("slackbot", serverKeys)).toBe("slack");
  });

  it("returns null for unknown server", () => {
    expect(matchRegistryKey("unknown-server", serverKeys)).toBeNull();
  });
});

describe("lookupRegistryKey", () => {
  it("returns key and entry for known server", () => {
    expect(lookupRegistryKey("slack")).toEqual({
      key: "slack",
      entry: { kind: "base", withIcon: true },
    });
  });

  it("resolves prefix variant to registry key and entry", () => {
    expect(lookupRegistryKey("github-mcp")).toEqual({
      key: "github",
      entry: { kind: "base", withIcon: true },
    });
  });

  it("returns null for unknown server", () => {
    expect(lookupRegistryKey("unknown-server")).toBeNull();
  });
});

describe("extractPrefix", () => {
  it("splits at hyphen when no displayName", () => {
    expect(extractPrefix("github-mcp")).toBe("github");
  });

  it("splits at underscore when no displayName", () => {
    expect(extractPrefix("slack_bot")).toBe("slack");
  });

  it("returns name as-is when no separator", () => {
    expect(extractPrefix("notion")).toBe("notion");
  });
});

describe("getAgentIconUrl", () => {
  it("returns iconify URL for custom kind", () => {
    expect(getAgentIconUrl("cursor")).toBe(
      "https://api.iconify.design/simple-icons/cursor.svg",
    );
  });

  it("includes color param for custom kind with color", () => {
    expect(getAgentIconUrl("claudecode")).toBe(
      "https://api.iconify.design/cbi/claude-clawd.svg?color=%23d97757",
    );
  });

  it("returns local /icons/<key>.svg path for local kind", () => {
    expect(getAgentIconUrl("codex")).toBe("/icons/codex.svg");
    expect(getAgentIconUrl("Gemini CLI")).toBe("/icons/geminicli.svg");
  });

  it("falls back to MCP URL for unknown agent", () => {
    expect(getAgentIconUrl("unknown-agent")).toContain(
      "hugeicons/mcp-server.svg",
    );
  });
});
