import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useSkills, useSkillsFeatureEnabled } from "@/data/skills";
import type { SavedSetupItem, Skill } from "@mcpx/shared-model";

import { SavedSetupSheet } from "./SavedSetupSheet";

vi.mock("@/data/skills", () => ({
  useSkillsFeatureEnabled: vi.fn(),
  useSkills: vi.fn(),
}));
vi.mock("@/data/catalog-servers", () => ({
  useGetMCPServers: vi.fn(),
}));
vi.mock("@/store", () => ({
  useSocketStore: (
    selector: (state: {
      systemState: {
        targetServers: Array<{
          name: string;
          catalogItemId: string;
          tools: unknown[];
          prompts: unknown[];
        }>;
      };
    }) => unknown,
  ) =>
    selector({
      systemState: {
        targetServers: [
          {
            name: "github",
            catalogItemId: "catalog-github",
            tools: [{ name: "list_issues" }, { name: "create_issue" }],
            prompts: [],
          },
        ],
      },
    }),
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const SKILL_ID = "0190a000-0000-7000-8000-000000000001";
const skill: Skill = {
  id: SKILL_ID,
  name: "Review Pull Requests",
  description: "Review repository changes.",
  body: "# Review",
  exposeAsPrompt: true,
  author: { setupOwnerId: "owner", displayName: "Owner" },
  updatedAt: new Date("2026-08-03T10:00:00.000Z"),
  publishedAt: null,
  capabilityGroup: {
    items: [
      {
        catalogItemId: "catalog-github",
        tools: ["list_issues", "create_issue"],
        prompts: [],
      },
    ],
  },
};

const setup = {
  id: "0190a000-0000-7000-8000-000000000010",
  description: "Engineering setup",
  savedAt: "2026-08-03T10:00:00.000Z",
  targetServers: {},
  config: {
    toolGroups: [
      {
        name: "Legacy tools",
        description: "Legacy tool group.",
        services: { github: ["list_issues"] },
      },
    ],
    skills: {
      enabled: [
        {
          subject: { kind: "clientName", value: "cursor" },
          skillIds: [SKILL_ID],
        },
      ],
    },
  },
} as SavedSetupItem;

beforeEach(() => {
  vi.mocked(useSkills).mockReturnValue({
    data: [skill],
    isLoading: false,
  } as never);
  vi.mocked(useGetMCPServers).mockReturnValue({
    data: [],
    isLoading: false,
  } as never);
});

describe("SavedSetupSheet", () => {
  it("shows skill details instead of tool groups when Skills is enabled", () => {
    vi.mocked(useSkillsFeatureEnabled, { partial: true }).mockReturnValue({
      data: true,
    });

    renderSheet();

    expect(screen.getByRole("heading", { name: "Skills" })).toBeVisible();
    expect(screen.getByText("Review Pull Requests")).toBeVisible();
    expect(screen.getByText("Review repository changes.")).toBeVisible();
    expect(screen.getByText("1 server · 2 tools")).toBeVisible();
    expect(screen.getByText("1 skill selected")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Tool Groups" }),
    ).not.toBeInTheDocument();
    expect(useSkills).toHaveBeenCalledWith({ enabled: true });
  });

  it("keeps tool group details when Skills is disabled", () => {
    vi.mocked(useSkillsFeatureEnabled, { partial: true }).mockReturnValue({
      data: false,
    });

    renderSheet();

    expect(screen.getByRole("heading", { name: "Tool Groups" })).toBeVisible();
    expect(screen.getByText("Legacy tools")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Skills" }),
    ).not.toBeInTheDocument();
    expect(useSkills).toHaveBeenCalledWith({ enabled: false });
  });

  it("keeps unavailable saved skills visible by id", () => {
    vi.mocked(useSkillsFeatureEnabled, { partial: true }).mockReturnValue({
      data: true,
    });
    vi.mocked(useSkills).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);

    renderSheet();

    expect(screen.getByText(SKILL_ID)).toBeVisible();
    expect(screen.getByText("Skill is no longer available.")).toBeVisible();
  });
});

function renderSheet() {
  render(
    <TooltipProvider>
      <SavedSetupSheet
        isOpen
        onOpenChange={vi.fn()}
        setup={setup}
        onRestore={vi.fn()}
        onOverwrite={vi.fn()}
        onDelete={vi.fn()}
      />
    </TooltipProvider>,
  );
}
