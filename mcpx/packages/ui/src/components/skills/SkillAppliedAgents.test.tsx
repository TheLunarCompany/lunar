import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ScopeSubject } from "@mcpx/shared-model";
import { describe, expect, it, vi } from "vitest";
import type { SkillAgentOption } from "@/mapping/skill-agents";
import { SkillAppliedAgents } from "./SkillAppliedAgents";

const consumerSubject: ScopeSubject = {
  kind: "consumerTag",
  value: "engineering",
};
const clientSubject: ScopeSubject = {
  kind: "clientName",
  value: "cursor-desktop",
};
const offlineSubject: ScopeSubject = {
  kind: "consumerTag",
  value: "legacy-agent",
};

const options: SkillAgentOption[] = [
  {
    key: "consumerTag:engineering",
    subject: consumerSubject,
    label: "Engineering agent",
    connected: true,
  },
  {
    key: "clientName:cursor-desktop",
    subject: clientSubject,
    label: "Cursor desktop",
    connected: true,
  },
  {
    key: "consumerTag:legacy-agent",
    subject: offlineSubject,
    label: "Legacy agent",
    connected: false,
  },
];

function renderComponent(
  props: Partial<React.ComponentProps<typeof SkillAppliedAgents>> = {},
) {
  return render(
    <SkillAppliedAgents
      options={options}
      appliedSubjects={[]}
      onSave={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );
}

describe("SkillAppliedAgents", () => {
  it("displays agent labels, subject kinds, and disconnected state", () => {
    renderComponent();

    expect(screen.getByText("Applied to agents")).toBeInTheDocument();
    expect(screen.getByText("Engineering agent")).toBeInTheDocument();
    expect(screen.getByText("Cursor desktop")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Engineering agent logo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Cursor desktop logo" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Consumer tag")).toHaveLength(2);
    expect(screen.getByText("Client name")).toBeInTheDocument();
    expect(screen.getByText("Not currently connected")).toBeInTheDocument();
  });

  it("filters visible rows without dropping a hidden selection", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderComponent({ appliedSubjects: [consumerSubject], onSave });

    await user.type(
      screen.getByRole("searchbox", { name: "Search agents" }),
      "Cursor",
    );

    expect(
      screen.queryByRole("checkbox", { name: /Engineering agent/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: /Cursor desktop.*Client name/ }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith([consumerSubject, clientSubject]);
  });

  it("provides keyboard-reachable checkboxes with accessible names", async () => {
    const user = userEvent.setup();
    renderComponent();

    const checkbox = screen.getByRole("checkbox", {
      name: /Engineering agent.*Consumer tag/,
    });
    await user.tab();
    await user.tab();

    expect(checkbox).toHaveFocus();
    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
  });

  it("enables save only while dirty, saves exact subjects, and resets after success", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderComponent({ appliedSubjects: [consumerSubject], onSave });
    const saveButton = screen.getByRole("button", { name: "Save changes" });

    expect(saveButton).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: /Cursor desktop.*Client name/ }),
    );
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledWith([consumerSubject, clientSubject]);
    await waitFor(() => expect(saveButton).toBeDisabled());
  });

  it("keeps rejected changes dirty and allows retry", async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(undefined);
    renderComponent({ onSave });
    const checkbox = screen.getByRole("checkbox", {
      name: /Engineering agent.*Consumer tag/,
    });
    const saveButton = screen.getByRole("button", { name: "Save changes" });

    await user.click(checkbox);
    await user.click(saveButton);
    await waitFor(() => expect(saveButton).toBeEnabled());
    expect(checkbox).toBeChecked();

    await user.click(saveButton);
    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith([consumerSubject]);
  });

  it("syncs incoming server truth only when the draft is clean", async () => {
    const user = userEvent.setup();
    const { rerender } = renderComponent();

    rerender(
      <SkillAppliedAgents
        options={options}
        appliedSubjects={[consumerSubject]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: /Engineering agent/ }),
    ).toBeChecked();

    await user.click(
      screen.getByRole("checkbox", { name: /Cursor desktop.*Client name/ }),
    );
    rerender(
      <SkillAppliedAgents
        options={options}
        appliedSubjects={[offlineSubject]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: /Engineering agent/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Cursor desktop/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Legacy agent/ }),
    ).not.toBeChecked();
  });

  it("applies pending server truth after a dirty draft returns to its current baseline", async () => {
    const user = userEvent.setup();
    const { rerender } = renderComponent();
    const engineeringCheckbox = screen.getByRole("checkbox", {
      name: /Engineering agent/,
    });

    await user.click(engineeringCheckbox);
    rerender(
      <SkillAppliedAgents
        options={options}
        appliedSubjects={[offlineSubject]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(engineeringCheckbox).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Legacy agent/ }),
    ).not.toBeChecked();

    await user.click(engineeringCheckbox);

    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /Legacy agent/ }),
      ).toBeChecked(),
    );
  });

  it("uses canonical subject identity when an option key is mismatched", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderComponent({
      appliedSubjects: [consumerSubject],
      onSave,
      options: [{ ...options[0], key: "stale-key" }],
    });
    const checkbox = screen.getByRole("checkbox", {
      name: /Engineering agent.*Consumer tag/,
    });

    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith([]);
  });

  it("accepts incoming server truth that matches an in-flight draft", async () => {
    const user = userEvent.setup();
    let rejectSave!: (reason?: unknown) => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    const { rerender } = renderComponent({ onSave });
    const checkbox = screen.getByRole("checkbox", {
      name: /Engineering agent/,
    });
    const saveButton = screen.getByRole("button", { name: "Save changes" });

    await user.click(checkbox);
    await user.click(saveButton);
    rerender(
      <SkillAppliedAgents
        options={options}
        appliedSubjects={[consumerSubject]}
        onSave={onSave}
      />,
    );
    rejectSave(new Error("request rejected after server acceptance"));

    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(saveButton).toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  it("uses canonical subject keys for React row identity", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      renderComponent({
        options: [
          { ...options[0], key: "duplicate-stale-key" },
          { ...options[1], key: "duplicate-stale-key" },
        ],
      });

      expect(screen.getByText("Engineering agent")).toBeInTheDocument();
      expect(screen.getByText("Cursor desktop")).toBeInTheDocument();
      expect(
        consoleError.mock.calls.some((call) =>
          call.join(" ").includes("same key"),
        ),
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("syncs distinct server truths whose subject keys collide when newline-joined", () => {
    const initialSubjects: ScopeSubject[] = [
      { kind: "clientName", value: "a" },
      { kind: "clientName", value: "b\nclientName:c" },
    ];
    const nextSubjects: ScopeSubject[] = [
      { kind: "clientName", value: "a\nclientName:b" },
      { kind: "clientName", value: "c" },
    ];
    const newlineOptions: SkillAgentOption[] = [
      ...initialSubjects.map((subject, index) => ({
        key: `initial-${index}`,
        subject,
        label: `Initial ${index + 1}`,
        connected: true,
      })),
      ...nextSubjects.map((subject, index) => ({
        key: `next-${index}`,
        subject,
        label: `Next ${index + 1}`,
        connected: true,
      })),
    ];
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderComponent({
      options: newlineOptions,
      appliedSubjects: initialSubjects,
      onSave,
    });

    rerender(
      <SkillAppliedAgents
        options={newlineOptions}
        appliedSubjects={nextSubjects}
        onSave={onSave}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: /Initial 1/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Initial 2/ }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Next 1/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Next 2/ })).toBeChecked();
  });

  it.each([
    [{ loading: true }, "Loading agents…"],
    [{ error: true }, "Unable to load agents."],
    [{ options: [] }, "No agents available."],
  ])("renders the expected status for %o", (props, message) => {
    renderComponent(props);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("disables search, selection, and save while saving", () => {
    renderComponent({ appliedSubjects: [consumerSubject], saving: true });

    expect(
      screen.getByRole("searchbox", { name: "Search agents" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /Engineering agent/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});
