import type { Agent } from "@/types";
import { agentsData } from "./constants";
import {
  deriveAgentDisplay,
  iconForAgentName,
  prettifiedAgentName,
} from "./agent-display";

function makeAgentBase(): Omit<Agent, "identityType"> & {
  identityType?: never;
} {
  return {
    id: "agent-1",
    identifier: "ignored-by-derive",
    sessionIds: ["s1"],
    status: "connected",
    usage: { callCount: 0 },
    dynamicMode: false,
    visibleTools: [],
    connectionState: "connected",
  };
}

function tagAgent(consumerTag: string, clientNames: string[]): Agent {
  return {
    ...makeAgentBase(),
    identityType: "consumerTag",
    consumerTag,
    clientNames,
  };
}

function clientAgent(clientName: string): Agent {
  return {
    ...makeAgentBase(),
    identityType: "clientName",
    clientName,
  };
}

function anonymousAgent(): Agent {
  return { ...makeAgentBase(), identityType: "anonymous" };
}

describe("prettifiedAgentName", () => {
  it("→ recognized client returns the prettified name from agentsData", () => {
    expect(prettifiedAgentName("cursor-vscode")).toBe("Cursor");
    expect(prettifiedAgentName("claude-ai")).toBe("Claude Desktop");
    expect(prettifiedAgentName("inspector-client")).toBe("Inspector");
  });

  it("→ unrecognized client returns the raw name (not 'Default')", () => {
    expect(prettifiedAgentName("some-custom-bot")).toBe("some-custom-bot");
  });

  it("→ Gemini CLI / OpenCode connection names prettify to their canonical labels", () => {
    // raw differs from the canonical label, so DEFAULT fallthrough would
    // surface the raw name instead — guards the dashboard resolver wiring.
    expect(prettifiedAgentName("gemini")).toBe("Gemini CLI");
    expect(prettifiedAgentName("opencode")).toBe("OpenCode");
  });
});

describe("iconForAgentName", () => {
  it("→ recognized client returns that client's icon + matching alt", () => {
    const cursor = iconForAgentName("cursor-vscode");
    expect(cursor.src).toBe(agentsData.CURSOR.icon);
    expect(cursor.alt).toBe("Cursor Agent Avatar");
  });

  it("→ unrecognized name falls back to the DEFAULT icon", () => {
    const fallback = iconForAgentName("some-custom-bot");
    expect(fallback.src).toBe(agentsData.DEFAULT.icon);
    expect(fallback.alt).toBe("Default Agent Avatar");
  });

  it("→ Gemini CLI / OpenCode resolve to their dedicated icons, not DEFAULT", () => {
    const gemini = iconForAgentName("Gemini CLI");
    expect(gemini.src).toBe(agentsData["gemini-cli"].icon);
    expect(gemini.src).not.toBe(agentsData.DEFAULT.icon);
    expect(gemini.alt).toBe("Gemini CLI Agent Avatar");

    const opencode = iconForAgentName("OpenCode");
    expect(opencode.src).toBe(agentsData.opencode.icon);
    expect(opencode.src).not.toBe(agentsData.DEFAULT.icon);
    expect(opencode.alt).toBe("OpenCode Agent Avatar");
  });
});

describe("deriveAgentDisplay", () => {
  describe("when the agent is a consumerTag cluster", () => {
    it("→ title is the tag itself, no prettification", () => {
      const display = deriveAgentDisplay(
        tagAgent("team-foo", ["cursor-vscode"]),
      );
      expect(display.title).toBe("team-foo");
    });

    it("→ subtitle shows the first client prettified, with extraCount=0 when only one", () => {
      const display = deriveAgentDisplay(
        tagAgent("team-foo", ["cursor-vscode"]),
      );
      expect(display.subtitle).toEqual({
        primary: "Cursor",
        extraCount: 0,
        allPrettified: ["Cursor"],
      });
    });

    it("→ subtitle's allPrettified carries every underlying client (in order)", () => {
      const display = deriveAgentDisplay(
        tagAgent("team-foo", [
          "cursor-vscode",
          "inspector-client",
          "claude-ai",
          "some-custom-bot",
        ]),
      );
      expect(display.subtitle?.allPrettified).toEqual([
        "Cursor",
        "Inspector",
        "Claude Desktop",
        "some-custom-bot",
      ]);
    });

    it("→ subtitle's extraCount is the number of additional clients beyond the first", () => {
      const display = deriveAgentDisplay(
        tagAgent("team-foo", [
          "cursor-vscode",
          "inspector-client",
          "claude-ai",
        ]),
      );
      expect(display.subtitle?.primary).toBe("Cursor");
      expect(display.subtitle?.extraCount).toBe(2);
    });

    it("→ no underlying clients → no subtitle, icon falls back to DEFAULT", () => {
      const display = deriveAgentDisplay(tagAgent("team-foo", []));
      expect(display.subtitle).toBeUndefined();
      expect(display.icon.src).toBe(agentsData.DEFAULT.icon);
    });
  });

  describe("when the agent is a clientName cluster", () => {
    it("→ title is the prettified client name", () => {
      expect(deriveAgentDisplay(clientAgent("claude-ai")).title).toBe(
        "Claude Desktop",
      );
    });

    it("→ unrecognized client name falls through to the raw name as title", () => {
      expect(deriveAgentDisplay(clientAgent("some-custom-bot")).title).toBe(
        "some-custom-bot",
      );
    });

    it("→ no subtitle (the title already conveys the identity)", () => {
      expect(
        deriveAgentDisplay(clientAgent("cursor-vscode")).subtitle,
      ).toBeUndefined();
    });

    it("→ icon matches the recognized client", () => {
      expect(deriveAgentDisplay(clientAgent("cursor-vscode")).icon.src).toBe(
        agentsData.CURSOR.icon,
      );
    });
  });

  describe("when the agent is anonymous", () => {
    it("→ title is the literal 'Anonymous' sentinel", () => {
      expect(deriveAgentDisplay(anonymousAgent()).title).toBe("Anonymous");
    });

    it("→ no subtitle", () => {
      expect(deriveAgentDisplay(anonymousAgent()).subtitle).toBeUndefined();
    });

    it("→ uses the DEFAULT icon", () => {
      expect(deriveAgentDisplay(anonymousAgent()).icon.src).toBe(
        agentsData.DEFAULT.icon,
      );
    });
  });
});
