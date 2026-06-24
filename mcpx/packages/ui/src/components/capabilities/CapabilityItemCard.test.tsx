import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Braces,
  Disc3,
  Eye,
  FilePenLine,
  GitBranch,
  MessageSquareText,
  Trash2,
} from "lucide-react";

import { CapabilityItemCard } from "./CapabilityItemCard";

describe("CapabilityItemCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the tool case with status, description, and metrics", () => {
    const { container } = render(
      <CapabilityItemCard>
        <CapabilityItemCard.Header>
          <CapabilityItemCard.TitleBadge icon={<GitBranch />}>
            create_repository
          </CapabilityItemCard.TitleBadge>
          <CapabilityItemCard.StatusBadge>
            READ ONLY
          </CapabilityItemCard.StatusBadge>
        </CapabilityItemCard.Header>
        <CapabilityItemCard.Description>
          This channel is used to monitor support tickets.
        </CapabilityItemCard.Description>
        <CapabilityItemCard.Divider />
        <CapabilityItemCard.Metrics>
          <CapabilityItemCard.Metric
            icon={<Braces />}
            value={4}
            label="Input fields"
          />
          <CapabilityItemCard.Metric
            icon={<Disc3 />}
            value={75}
            label="Resources"
          />
        </CapabilityItemCard.Metrics>
      </CapabilityItemCard>,
    );

    expect(container.querySelector('[data-slot="card"]')?.className).toContain(
      "w-[376px]",
    );
    expect(screen.getByText("create_repository")).toBeInTheDocument();
    expect(screen.getByText("READ ONLY")).toHaveAttribute("data-slot", "badge");
    expect(
      screen.getByText("This channel is used to monitor support tickets."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Input fields: 4")).toBeInTheDocument();
    expect(screen.getByLabelText("Resources: 75")).toBeInTheDocument();
  });

  it("renders the prompt case with a menu trigger and no status badge", () => {
    render(
      <CapabilityItemCard>
        <CapabilityItemCard.Header>
          <CapabilityItemCard.TitleBadge variant="success">
            Web design template 1
          </CapabilityItemCard.TitleBadge>
          <CapabilityItemCard.Menu>
            <CapabilityItemCard.MenuButton />
          </CapabilityItemCard.Menu>
        </CapabilityItemCard.Header>
        <CapabilityItemCard.Description>
          The ID of the channel to post to
        </CapabilityItemCard.Description>
        <CapabilityItemCard.Divider />
        <CapabilityItemCard.Metrics>
          <CapabilityItemCard.Metric
            icon={<Braces />}
            value={4}
            label="Input fields"
          />
          <CapabilityItemCard.Metric
            icon={<MessageSquareText />}
            value={12}
            label="Messages"
          />
          <CapabilityItemCard.Metric
            icon={<Disc3 />}
            value={75}
            label="Resources"
          />
        </CapabilityItemCard.Metrics>
      </CapabilityItemCard>,
    );

    expect(screen.getByText("Web design template 1")).toBeInTheDocument();
    expect(screen.queryByText("READ ONLY")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open capability item menu" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Messages: 12")).toBeInTheDocument();
  });

  it("renders Details, Edit, and Delete menu items", () => {
    render(
      <CapabilityItemCard.Menu defaultOpen>
        <CapabilityItemCard.MenuButton />
        <CapabilityItemCard.MenuContent>
          <CapabilityItemCard.MenuItem>
            <Eye />
            Details
          </CapabilityItemCard.MenuItem>
          <CapabilityItemCard.MenuItem>
            <FilePenLine />
            Edit
          </CapabilityItemCard.MenuItem>
          <CapabilityItemCard.MenuItem variant="destructive">
            <Trash2 />
            Delete
          </CapabilityItemCard.MenuItem>
        </CapabilityItemCard.MenuContent>
      </CapabilityItemCard.Menu>,
    );

    expect(
      screen.getByRole("menuitem", { name: "Details" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete" }),
    ).toBeInTheDocument();
  });

  it("uses visible variable backgrounds for title badge variants", () => {
    render(
      <>
        <CapabilityItemCard.TitleBadge>
          Interactive tool
        </CapabilityItemCard.TitleBadge>
        <CapabilityItemCard.TitleBadge variant="success">
          Success prompt
        </CapabilityItemCard.TitleBadge>
      </>,
    );

    expect(
      screen.getByText("Interactive tool").parentElement?.className,
    ).toContain("--colors-primary-100");
    expect(
      screen.getByText("Success prompt").parentElement?.className,
    ).toContain("--colors-success-100");
  });

  it("lets a long title badge shrink beside a status badge", () => {
    const { container } = render(
      <CapabilityItemCard>
        <CapabilityItemCard.Header>
          <CapabilityItemCard.TitleBadge icon={<GitBranch />}>
            create_repository_with_a_very_long_name_that_truncates
          </CapabilityItemCard.TitleBadge>
          <CapabilityItemCard.StatusBadge>
            READ ONLY
          </CapabilityItemCard.StatusBadge>
        </CapabilityItemCard.Header>
      </CapabilityItemCard>,
    );

    expect(
      container.querySelector('[data-slot="card"] > div')?.className,
    ).not.toContain("pr-8");
    expect(
      screen.getByText("create_repository_with_a_very_long_name_that_truncates")
        .parentElement?.className,
    ).toContain("min-w-0");
  });

  it("clamps long descriptions to keep card height stable", () => {
    render(
      <CapabilityItemCard.Description>
        This is a long description that should wrap naturally but stop after two
        lines so repeated cards keep a stable height in dense grids and lists.
      </CapabilityItemCard.Description>,
    );

    expect(screen.getByText(/This is a long description/).className).toContain(
      "line-clamp-2",
    );
  });
});
