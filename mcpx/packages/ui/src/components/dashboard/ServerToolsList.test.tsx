import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ServerPromptsList } from "./ServerToolsList";

describe("ServerPromptsList", () => {
  it("renders prompts with prompt-specific search and empty copy", () => {
    render(
      <ServerPromptsList
        prompts={[
          {
            name: "draft-release-notes",
            description: "Draft release notes from merged changes.",
            invocations: 0,
          },
        ]}
      />,
    );

    expect(
      screen.getByPlaceholderText("Search prompts..."),
    ).toBeInTheDocument();
    expect(screen.getByText("draft-release-notes")).toBeInTheDocument();
    expect(screen.queryByText("Search tools...")).toBeNull();
    expect(screen.getByTestId("server-prompt-icon")).toBeInTheDocument();
    expect(screen.getByTestId("server-prompt-badge")).toHaveClass(
      "bg-[var(--colors-success-100)]",
    );
  });
});
