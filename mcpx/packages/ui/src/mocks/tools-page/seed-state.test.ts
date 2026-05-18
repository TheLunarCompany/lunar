import { beforeEach, describe, expect, it } from "vitest";
import { socketStore } from "@/store/socket";
import { toolsStore } from "@/store/tools";
import { seedToolsPageMockState } from "./seed-state";

describe("seedToolsPageMockState", () => {
  beforeEach(() => {
    window.__MCPX_TEST_MODE__ = false;
    socketStore.setState({
      appConfig: null,
      isConnected: false,
      isPending: true,
      serializedAppConfig: null,
      systemState: null,
    });
    toolsStore.setState({ customTools: [], tools: [] });
  });

  it("seeds socket and tools state for the tools page dev mock", () => {
    seedToolsPageMockState();

    const state = socketStore.getState();

    expect(window.__MCPX_TEST_MODE__).toBe(true);
    expect(state.isConnected).toBe(true);
    expect(state.isPending).toBe(false);
    expect(state.serializedAppConfig).toEqual(
      expect.objectContaining({
        yaml: expect.any(String),
        version: 1,
      }),
    );
    expect(
      state.systemState?.targetServers.map((server) => server.name),
    ).toEqual(["github", "linear", "calculator", "broken-server"]);

    const githubServer = state.systemState?.targetServers.find(
      (server) => server.name === "github",
    );
    expect(githubServer?.originalPrompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "issue_template",
        }),
      ]),
    );

    const linearServer = state.systemState?.targetServers.find(
      (server) => server.name === "linear",
    );
    expect(linearServer?.originalPrompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "issue_triage_summary",
        }),
      ]),
    );

    expect(state.appConfig?.toolGroups).toEqual(
      expect.arrayContaining([
        {
          name: "GitHub Triage",
          description: "Issue triage tools and prompts for GitHub workflows.",
          services: {
            github: [
              "create_issue",
              "list_issues",
              "issue_template",
              "internal_pr_template",
            ],
          },
        },
        {
          name: "Linear Workflows",
          description:
            "Planning and issue management tools and prompts for Linear workflows.",
          services: {
            linear: [
              "auth_linear",
              "list_issues",
              "create_issue",
              "update_issue_status",
              "issue_triage_summary",
              "sprint_planning_brief",
            ],
          },
        },
        {
          name: "Sprint Planning",
          description: "Cross-system planning context for sprint preparation.",
          services: {
            github: ["list_issues"],
            linear: ["list_projects", "sprint_planning_brief"],
          },
        },
        {
          name: "All GitHub Capabilities",
          description: "Wildcard group covering every GitHub tool and prompt.",
          services: {
            github: "*",
          },
        },
      ]),
    );
    expect(state.appConfig?.toolGroups).toHaveLength(10);
    expect(toolsStore.getState().tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "create_issue",
          serviceName: "github",
        }),
        expect.objectContaining({
          name: "list_issues",
          serviceName: "linear",
        }),
      ]),
    );
    expect(toolsStore.getState().customTools).toEqual([]);
    expect(state.serializedAppConfig?.yaml).toContain(
      '    description: "Issue triage tools and prompts for GitHub workflows."',
    );
    expect(state.serializedAppConfig?.yaml).toContain(
      '        - "issue_template"',
    );
    expect(state.serializedAppConfig?.yaml).toContain(
      '        - "internal_pr_template"',
    );
    expect(state.serializedAppConfig?.yaml).toContain(
      '    description: "Planning and issue management tools and prompts for Linear workflows."',
    );
    expect(state.serializedAppConfig?.yaml).toContain(
      '        - "issue_triage_summary"',
    );
    expect(state.serializedAppConfig?.yaml).toContain(
      '        - "sprint_planning_brief"',
    );
    expect(state.serializedAppConfig?.yaml).toContain(
      '  - name: "Sprint Planning"',
    );
    expect(state.serializedAppConfig?.yaml).toContain('      github: "*"');
  });

  it("keeps every mock tool group described", () => {
    seedToolsPageMockState();

    const toolGroups = socketStore.getState().appConfig?.toolGroups ?? [];

    expect(toolGroups.length).toBeGreaterThan(0);
    expect(toolGroups.every((group) => group.description?.trim())).toBe(true);
  });
});
