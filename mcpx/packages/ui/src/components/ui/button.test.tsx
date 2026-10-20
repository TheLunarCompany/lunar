import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button semantic colors", () => {
  it("uses the selected color for the default action", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });

    expect(button).toHaveClass("bg-mcpx-selected");
    expect(button).toHaveClass("text-primary-foreground");
  });

  it("uses the danger action color for destructive actions", () => {
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole("button", { name: "Delete" });

    expect(button).toHaveClass("bg-destructive");
    expect(button).toHaveClass("text-destructive-foreground");
  });

  it("forwards its ref to the rendered button", () => {
    const ref = createRef<HTMLButtonElement>();

    render(<Button ref={ref}>Open</Button>);

    expect(ref.current).toBe(screen.getByRole("button", { name: "Open" }));
  });
});
