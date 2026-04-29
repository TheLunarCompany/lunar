import { act, cleanup, render, screen } from "@testing-library/react";
import { forwardRef } from "react";
import type {
  ComponentProps,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type CapturedCreatableComboboxProps = Record<string, unknown> | null;
type CapturedComboboxContentProps = Record<string, unknown> | null;
type CapturedComboboxInputProps = Record<string, unknown> | null;

let latestCreatableComboboxProps: CapturedCreatableComboboxProps = null;
let latestComboboxContentProps: CapturedComboboxContentProps = null;
let latestComboboxInputProps: CapturedComboboxInputProps = null;

vi.mock("@/components/ui/creatable-combobox", async () => {
  type MockCreatableComboboxProps = {
    children?: ReactNode;
  } & Record<string, unknown>;

  type MockCreatableItemProps = HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
    value?: { label?: string };
  };

  return {
    CreatableCombobox: ({ children, ...props }: MockCreatableComboboxProps) => {
      latestCreatableComboboxProps = props;
      return <div data-testid="creatable-combobox">{children}</div>;
    },
    ComboboxItemCreatable: ({
      children,
      value,
      ...props
    }: MockCreatableItemProps) => (
      <div data-testid="creatable-item" {...props}>
        {children ?? value?.label}
      </div>
    ),
    isCreatableItem: (item: unknown) =>
      typeof item === "object" &&
      item !== null &&
      (item as { creatable?: boolean }).creatable === true,
  };
});

vi.mock("@/components/ui/combobox", async () => {
  const ComboboxInput = forwardRef<
    HTMLInputElement,
    InputHTMLAttributes<HTMLInputElement> & {
      showClear?: boolean;
      showTrigger?: boolean;
    }
  >(({ showClear, showTrigger, ...props }, ref) => {
    latestComboboxInputProps = { ...props, showClear, showTrigger };
    return <input ref={ref} role="combobox" {...props} />;
  });

  return {
    ComboboxInput,
    ComboboxContent: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & {
      children?: ReactNode;
    } & Record<string, unknown>) => {
      latestComboboxContentProps = props;
      return <div data-testid="combobox-content">{children}</div>;
    },
    ComboboxEmpty: ({ children }: { children?: ReactNode }) => (
      <div data-testid="combobox-empty">{children}</div>
    ),
    ComboboxList: ({ children }: { children?: ReactNode }) => (
      <div data-testid="combobox-list">{children}</div>
    ),
    ComboboxItem: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  };
});

import { EnvReferenceInput } from "./EnvReferenceInput";

describe("EnvReferenceInput", () => {
  afterEach(() => {
    latestCreatableComboboxProps = null;
    latestComboboxContentProps = null;
    latestComboboxInputProps = null;
    cleanup();
  });

  function renderInput(
    overrides: Partial<ComponentProps<typeof EnvReferenceInput>> = {},
    container?: HTMLElement,
  ) {
    const onChange = vi.fn();

    const result = render(
      <EnvReferenceInput
        value=""
        onChange={onChange}
        disabled={false}
        secrets={["DB_PASSWORD", "API_TOKEN"]}
        isLoading={false}
        {...overrides}
      />,
      container ? { container } : undefined,
    );

    const input = screen.getByRole("combobox", {
      name: "Environment variable or secret reference",
    });

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected combobox query to resolve to an input element");
    }

    return {
      ...result,
      onChange,
      input,
    };
  }

  function getCreatableComboboxProps() {
    if (!latestCreatableComboboxProps) {
      throw new Error("CreatableCombobox props were not captured");
    }

    return latestCreatableComboboxProps as {
      inputValue: string;
      onCreateValue: (value: string) => void;
      onQueryChange: (value: string) => void;
      onValueChange: (value: unknown) => void;
      createLabel: (value: string) => string;
    };
  }

  function getComboboxContentProps() {
    if (!latestComboboxContentProps) {
      throw new Error("ComboboxContent props were not captured");
    }

    return latestComboboxContentProps as {
      container: HTMLElement | null;
    };
  }

  function getComboboxInputProps() {
    if (!latestComboboxInputProps) {
      throw new Error("ComboboxInput props were not captured");
    }

    return latestComboboxInputProps as {
      showClear?: boolean;
    };
  }

  it("disables the input and shows the loading placeholder while secrets load", () => {
    const { input } = renderInput({ isLoading: true });

    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Loading references...");
  });

  it("syncs the query state when the value prop changes", () => {
    const { rerender } = renderInput({ value: "DB_PASSWORD" });

    expect(getCreatableComboboxProps().inputValue).toBe("DB_PASSWORD");

    rerender(
      <EnvReferenceInput
        value="UPSTREAM_URL"
        onChange={vi.fn()}
        disabled={false}
        secrets={["DB_PASSWORD", "API_TOKEN"]}
        isLoading={false}
      />,
    );

    expect(getCreatableComboboxProps().inputValue).toBe("UPSTREAM_URL");
  });

  it("resolves selected secret options to fromSecret", () => {
    const { onChange } = renderInput();

    getCreatableComboboxProps().onValueChange({
      key: "secret:DB_PASSWORD",
      kind: "secret",
      value: "DB_PASSWORD",
      label: "DB_PASSWORD",
    });

    expect(onChange).toHaveBeenCalledWith("fromSecret", "DB_PASSWORD");
  });

  it("creates env references and restores focus to the input", async () => {
    const { input, onChange } = renderInput();
    const setSelectionRangeSpy = vi.spyOn(input, "setSelectionRange");

    await act(async () => {
      getCreatableComboboxProps().onCreateValue("UPSTREAM_URL");

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    expect(onChange).toHaveBeenCalledWith("fromEnv", "UPSTREAM_URL");
    expect(setSelectionRangeSpy).toHaveBeenCalledWith(
      "UPSTREAM_URL".length,
      "UPSTREAM_URL".length,
    );
  });

  it("uses the surrounding dialog as the popup container", () => {
    const dialogContainer = document.createElement("div");
    dialogContainer.setAttribute("data-slot", "dialog-content");
    document.body.appendChild(dialogContainer);

    renderInput({}, dialogContainer);

    expect(getComboboxContentProps().container).toBe(dialogContainer);
  });

  it("keeps the explicit env creation label for free-text values", () => {
    renderInput();

    expect(getCreatableComboboxProps().createLabel("UPSTREAM_URL")).toBe(
      'Use env var "UPSTREAM_URL"',
    );
  });

  it("shows an error when typed text has not been selected or created", () => {
    const onDraftValidationChange = vi.fn();

    renderInput({ value: "DB_PASSWORD", onDraftValidationChange });

    act(() => {
      getCreatableComboboxProps().onQueryChange("UPSTREAM_URL");
    });

    expect(
      screen.getByText(
        "Click '+ Use env var \"UPSTREAM_URL\"' to apply this value",
      ),
    ).toBeInTheDocument();
    expect(onDraftValidationChange).toHaveBeenLastCalledWith(true);
  });

  it("clears a saved reference when the query is emptied", () => {
    const onDraftValidationChange = vi.fn();
    const { onChange } = renderInput({
      value: "DB_PASSWORD",
      onDraftValidationChange,
    });

    expect(getComboboxInputProps().showClear).toBe(true);

    act(() => {
      getCreatableComboboxProps().onQueryChange("");
    });

    expect(onChange).toHaveBeenCalledWith("fromEnv", "");
    expect(onDraftValidationChange).toHaveBeenLastCalledWith(false);
  });
});
