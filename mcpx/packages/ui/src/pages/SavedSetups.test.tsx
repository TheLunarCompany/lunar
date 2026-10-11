import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useDeleteSavedSetup,
  useGetSavedSetups,
  useOverwriteSavedSetup,
  useRestoreSavedSetup,
  useSaveSetup,
} from "@/data/saved-setups";
import { useSkills, useSkillsFeatureEnabled } from "@/data/skills";
import type { SavedSetupItem, Skill } from "@mcpx/shared-model";
import { TooltipProvider } from "@/components/ui/tooltip";

import SavedSetups from "./SavedSetups";

vi.mock("@/data/saved-setups", () => ({
  useDeleteSavedSetup: vi.fn(),
  useGetSavedSetups: vi.fn(),
  useOverwriteSavedSetup: vi.fn(),
  useRestoreSavedSetup: vi.fn(),
  useSaveSetup: vi.fn(),
}));
vi.mock("@/data/skills", () => ({
  useSkills: vi.fn(),
  useSkillsFeatureEnabled: vi.fn(),
}));
vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => "/server.svg",
}));
vi.mock("@/components/saved-setups/SavedSetupSheet", () => ({
  SavedSetupSheet: () => null,
}));
vi.mock("@/components/ui/ellipsis-action", () => ({
  EllipsisActions: ({
    items,
  }: {
    items: Array<{ label: string; callback: () => void }>;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.label} onClick={item.callback}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));
vi.mock("@/store", () => ({
  useSocketStore: (
    selector: (state: {
      systemState: { targetServers: unknown[] };
      appConfig: {
        toolGroups: unknown[];
        skills: {
          enabled: Array<{
            subject: { kind: "clientName"; value: string };
            skillIds: string[];
          }>;
        };
      };
    }) => unknown,
  ) =>
    selector({
      systemState: { targetServers: [{ name: "github" }] },
      appConfig: {
        toolGroups: [{ name: "Legacy tools" }],
        skills: {
          enabled: [
            {
              subject: { kind: "clientName", value: "cursor" },
              skillIds: [
                "0190a000-0000-7000-8000-000000000001",
                "0190a000-0000-7000-8000-000000000002",
                "0190a000-0000-7000-8000-000000000001",
              ],
            },
          ],
        },
      },
    }),
}));

const SKILL_ONE_ID = "0190a000-0000-7000-8000-000000000001";
const SKILL_TWO_ID = "0190a000-0000-7000-8000-000000000002";

const skills: Skill[] = [
  skill(SKILL_ONE_ID, "Review Pull Requests"),
  skill(SKILL_TWO_ID, "Debug Incidents"),
];

const setup: SavedSetupItem = {
  id: "0190a000-0000-7000-8000-000000000010",
  description: "Engineering setup",
  savedAt: "2026-08-03T10:00:00.000Z",
  targetServers: {},
  config: {
    toolGroups: [
      {
        name: "Legacy tools",
        services: { github: ["list_issues"] },
      },
    ],
    skills: {
      enabled: [
        {
          subject: { kind: "clientName", value: "cursor" },
          skillIds: [SKILL_ONE_ID, SKILL_TWO_ID, SKILL_ONE_ID],
        },
      ],
    },
  },
};

beforeEach(() => {
  vi.mocked(useGetSavedSetups).mockReturnValue({
    data: { setups: [setup] },
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSkills).mockReturnValue({
    data: skills,
    isLoading: false,
  } as never);

  const mutation = { mutate: vi.fn(), isPending: false } as never;
  vi.mocked(useSaveSetup).mockReturnValue(mutation);
  vi.mocked(useRestoreSavedSetup).mockReturnValue(mutation);
  vi.mocked(useDeleteSavedSetup).mockReturnValue(mutation);
  vi.mocked(useOverwriteSavedSetup).mockReturnValue(mutation);
});

describe("SavedSetups", () => {
  it("shows unique saved skills instead of tool groups when Skills is enabled", () => {
    vi.mocked(useSkillsFeatureEnabled, { partial: true }).mockReturnValue({
      data: true,
    });

    renderPage();

    expect(screen.getByText("SKILLS")).toBeVisible();
    expect(screen.getByText("Review Pull Requests")).toBeVisible();
    expect(screen.getByText("Debug Incidents")).toBeVisible();
    expect(screen.queryByText("TOOL GROUPS")).not.toBeInTheDocument();
    expect(useSkills).toHaveBeenCalledWith({ enabled: true });
  });

  it("keeps the tool groups card when Skills is disabled", () => {
    vi.mocked(useSkillsFeatureEnabled, { partial: true }).mockReturnValue({
      data: false,
    });

    renderPage();

    expect(screen.getByText("TOOL GROUPS")).toBeVisible();
    expect(screen.getByText("Legacy tools")).toBeVisible();
    expect(screen.queryByText("SKILLS")).not.toBeInTheDocument();
    expect(useSkills).toHaveBeenCalledWith({ enabled: false });
  });

  it("keeps an unavailable saved skill visible by id", () => {
    vi.mocked(useSkillsFeatureEnabled, { partial: true }).mockReturnValue({
      data: true,
    });
    vi.mocked(useSkills).mockReturnValue({
      data: [skills[0]],
      isLoading: false,
    } as never);

    renderPage();

    expect(screen.getByText(SKILL_TWO_ID).closest("div")).toHaveAttribute(
      "title",
      "Skill is no longer available",
    );
  });

  it("uses the unique skill count in the restore summary", () => {
    vi.mocked(useSkillsFeatureEnabled, { partial: true }).mockReturnValue({
      data: true,
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(
      screen.getByText(/current setup \(1 server and 2 skills\)/),
    ).toBeVisible();
  });
});

function renderPage() {
  render(
    <MemoryRouter>
      <TooltipProvider>
        <SavedSetups />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

function skill(id: string, name: string): Skill {
  return {
    id,
    name,
    description: `${name} description`,
    body: `# ${name}`,
    exposeAsPrompt: true,
    author: { setupOwnerId: "owner", displayName: "Owner" },
    updatedAt: new Date("2026-08-03T10:00:00.000Z"),
    publishedAt: null,
  };
}
