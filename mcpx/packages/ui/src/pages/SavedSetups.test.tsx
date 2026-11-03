import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  describe("Description Validation", () => {
    beforeEach(() => {
      vi.mocked(useSkillsFeatureEnabled, { partial: true }).mockReturnValue({
        data: false,
      });
    });

    it("shows character counter while typing description", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "Test Setup");

      expect(screen.getByText(/10 \/ 200/)).toBeVisible();
    });

    it("accepts valid characters without error", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "GitHub & Slack (prod), v1.0!");

      expect(screen.queryByText(/Invalid characters/)).not.toBeInTheDocument();
    });

    it("detects invalid character (@) and shows error", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "test@invalid");

      await waitFor(() => {
        expect(screen.getByText(/Invalid characters:/)).toBeVisible();
        expect(screen.getByText(/@/)).toBeVisible();
      });
    });

    it("detects invalid character (/) and shows error", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "prod/staging");

      await waitFor(() => {
        const errorText = screen.getByText(/Invalid characters:/);
        expect(errorText).toBeVisible();
        expect(errorText.textContent).toMatch(/\//);
      });
    });

    it("detects emoji as invalid character", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "🚀 Production");

      await waitFor(() => {
        expect(screen.getByText(/Invalid characters:/)).toBeVisible();
      });
    });

    it("disables Save button when description has invalid characters", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "invalid@desc");

      const saveButton = screen.getByRole("button", { name: /save setup/i });
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });

    it("enables Save button when all characters are valid", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "Valid Description");

      const saveButton = screen.getByRole("button", { name: /save setup/i });
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });

    it("shows info tooltip with allowed characters", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const labelText = screen.getByText("Description");
      const labelParent = labelText.closest("div");
      if (labelParent) {
        const tooltipButtons = labelParent.querySelectorAll("button");
        if (tooltipButtons.length > 0) {
          await user.hover(tooltipButtons[0]);
          await waitFor(() => {
            expect(
              screen.getByText(/letters, numbers, spaces/),
            ).toBeInTheDocument();
          });
        }
      }
    });

    it("clears error message when invalid characters are removed", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", {
        name: /description/i,
      }) as HTMLInputElement;
      await user.type(input, "invalid@");

      await waitFor(() => {
        expect(screen.getByText(/Invalid characters:/)).toBeVisible();
      });

      await user.clear(input);
      await user.type(input, "valid");

      expect(screen.queryByText(/Invalid characters:/)).not.toBeInTheDocument();
    });

    it("does not save on Enter key when description has invalid characters", async () => {
      const user = userEvent.setup();
      const mutation = { mutate: vi.fn(), isPending: false } as never;
      vi.mocked(useSaveSetup).mockReturnValue(mutation);

      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "invalid@");
      await user.keyboard("{Enter}");

      expect(mutation.mutate).not.toHaveBeenCalled();
    });

    it("saves on Enter key when description is valid", async () => {
      const user = userEvent.setup();
      const mutation = { mutate: vi.fn(), isPending: false } as never;
      vi.mocked(useSaveSetup).mockReturnValue(mutation);

      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "Valid Description");
      await user.keyboard("{Enter}");

      expect(mutation.mutate).toHaveBeenCalled();
    });

    it("accepts 200-character description", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      const desc200 = "a".repeat(200);
      await user.type(input, desc200);

      expect(screen.getByText(/200 \/ 200/)).toBeVisible();
      expect(screen.queryByText(/Invalid characters:/)).not.toBeInTheDocument();
    });

    it("displays multiple invalid characters when present", async () => {
      const user = userEvent.setup();
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await waitFor(() =>
        expect(
          screen.getByRole("textbox", { name: /description/i }),
        ).toBeInTheDocument(),
      );

      const input = screen.getByRole("textbox", { name: /description/i });
      await user.type(input, "test@invalid/path");

      await waitFor(() => {
        const errorText = screen.getByText(/Invalid characters:/);
        expect(errorText).toBeVisible();
        expect(errorText.textContent).toMatch(/@/);
        expect(errorText.textContent).toMatch(/\//);
      });
    });
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
