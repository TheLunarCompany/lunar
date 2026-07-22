import { noOpLogger } from "@mcpx/toolkit-core/logging";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  CapabilityOrigin,
  CapabilityRegistry,
  RegisteredPrompt,
  RegisteredTool,
} from "./capability-registry.js";
import { PromptMessage } from "@modelcontextprotocol/sdk/types.js";

function makeTool(
  name: string,
  origin: CapabilityOrigin = "upstream",
): RegisteredTool {
  return {
    definition: {
      name,
      description: `Tool ${name}`,
      inputSchema: { type: "object", properties: {} },
    },
    origin,
  };
}

function makePrompt(
  name: string,
  origin: CapabilityOrigin = "upstream",
): RegisteredPrompt {
  return { definition: { name, description: `Prompt ${name}` }, origin };
}

const sampleMessage = (text: string): PromptMessage => ({
  role: "user",
  content: { type: "text", text },
});

describe("CapabilityRegistry", () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry(noOpLogger);
  });

  afterEach(() => {
    registry.shutdown();
  });

  describe("registerServer", () => {
    it("exposes server after registration", () => {
      const tools = [makeTool("create_issue"), makeTool("list_issues")];
      registry.registerServer("github", { tools });

      expect(registry.servers.size).toBe(1);
      expect(registry.servers.get("github")?.tools).toHaveLength(2);
    });

    it("replaces existing tools on re-register", () => {
      registry.registerServer("github", { tools: [makeTool("old_tool")] });
      registry.registerServer("github", { tools: [makeTool("new_tool")] });

      const tools = registry.servers.get("github")?.tools ?? [];
      expect(tools).toHaveLength(1);
      expect(tools[0]?.definition.name).toBe("new_tool");
    });

    it("merges servers from multiple registrations without collision", () => {
      registry.registerServer("github", { tools: [makeTool("create_issue")] });
      registry.registerServer("slack", { tools: [makeTool("send_message")] });

      expect(registry.servers.size).toBe(2);
    });

    it("stores toolParentNames when provided", () => {
      registry.registerServer("github", {
        tools: [makeTool("create_issue_for_project")],
        toolParentNames: { create_issue_for_project: "create_issue" },
      });

      expect(registry.servers.get("github")?.toolParentNames).toEqual({
        create_issue_for_project: "create_issue",
      });
    });

    it("prunes promptMessages for prompts no longer advertised", () => {
      registry.registerServer("notion", {
        prompts: [makePrompt("summarize"), makePrompt("draft")],
        promptMessages: {
          summarize: [sampleMessage("a")],
          draft: [sampleMessage("b")],
        },
      });
      // "draft" dropped from the prompt set; its cached preview must go too.
      registry.registerServer("notion", {
        prompts: [makePrompt("summarize")],
        promptMessages: {
          summarize: [sampleMessage("a")],
          draft: [sampleMessage("b")],
        },
      });

      expect(registry.servers.get("notion")?.promptMessages).toEqual({
        summarize: [sampleMessage("a")],
      });
    });

    it("keeps promptMessages for still-advertised prompts", () => {
      registry.registerServer("notion", {
        prompts: [makePrompt("summarize")],
        promptMessages: { summarize: [sampleMessage("a")] },
      });

      expect(registry.servers.get("notion")?.promptMessages).toEqual({
        summarize: [sampleMessage("a")],
      });
    });

    it("leaves capabilities untouched when no promptMessages present", () => {
      const capabilities = { tools: [makeTool("a")] };
      registry.registerServer("github", capabilities);

      expect(registry.servers.get("github")?.promptMessages).toBeUndefined();
    });
  });

  describe("unregisterServer", () => {
    it("removes the server", () => {
      registry.registerServer("github", {
        tools: [makeTool("a"), makeTool("b")],
      });
      registry.registerServer("slack", { tools: [makeTool("c")] });
      registry.unregisterServer("github");

      expect(registry.servers.size).toBe(1);
      expect(registry.servers.has("slack")).toBe(true);
    });

    it("is a no-op when server was never registered", () => {
      expect(() => registry.unregisterServer("unknown")).not.toThrow();
    });
  });

  describe("onChanged", () => {
    it("fires on registerServer", () => {
      const cb = jest.fn<() => void>();
      registry.onChanged(cb);
      registry.registerServer("github", { tools: [makeTool("a")] });

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("fires once per state change", () => {
      const cb = jest.fn<() => void>();
      registry.onChanged(cb);

      registry.registerServer("github", { tools: [makeTool("a")] });
      registry.registerServer("slack", { tools: [makeTool("b")] });
      registry.unregisterServer("github");

      expect(cb).toHaveBeenCalledTimes(3);
    });

    it("unsubscribe stops future callbacks", () => {
      const cb = jest.fn<() => void>();
      const unsub = registry.onChanged(cb);
      unsub();

      registry.registerServer("github", { tools: [makeTool("a")] });
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe("shutdown", () => {
    it("clears all listeners", () => {
      const cb = jest.fn<() => void>();
      registry.onChanged(cb);
      registry.shutdown();

      registry.registerServer("github", { tools: [makeTool("a")] });
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
