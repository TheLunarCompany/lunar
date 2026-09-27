import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RadioGroup, RadioGroupItem } from "./radio-group";

describe("RadioGroupItem", () => {
  it("uses visible neutral styling for the unchecked state", () => {
    render(
      <RadioGroup aria-label="Mode">
        <RadioGroupItem value="literal" aria-label="Value" />
      </RadioGroup>,
    );

    const radio = screen.getByRole("radio", { name: "Value" });

    expect(radio).toHaveClass("border-2");
    expect(radio).toHaveClass("border-foreground/35");
    expect(radio).toHaveClass("bg-background");
    expect(radio).not.toHaveClass("border-input");
  });
});
