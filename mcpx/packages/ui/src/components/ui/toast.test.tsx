import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastViewport,
} from "./toast";

const LONG_ERROR =
  'Failed to obtain authorization URL for server "base44": All redirect_uris must be in the allowlist';

// Hand-written stub rather than a mock: records what was written so the
// assertions read the same way a caller would.
function stubClipboard(): { writes: string[]; restore: () => void } {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const writes: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        writes.push(text);
      },
    },
  });
  return {
    writes,
    restore: () => {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    },
  };
}

// Set to undefined rather than deleting: jsdom may expose clipboard on the
// prototype, where deleting the own property leaves it readable.
function removeClipboard(): () => void {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  return () => {
    if (original) Object.defineProperty(navigator, "clipboard", original);
  };
}

function renderToast(
  variant: "destructive" | "default",
  description: string = LONG_ERROR,
) {
  return render(
    <ToastProvider>
      <ToastViewport>
        <Toast variant={variant} copyText={description} open>
          <div>
            <ToastDescription>{description}</ToastDescription>
          </div>
          {null}
          <ToastClose />
        </Toast>
      </ToastViewport>
    </ToastProvider>,
  );
}

describe("Toast copy button", () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  it("copies the full message, not the truncated text", async () => {
    const clipboard = stubClipboard();
    cleanups.push(clipboard.restore);
    renderToast("destructive");

    await userEvent.click(screen.getByRole("button", { name: "Copy message" }));

    expect(clipboard.writes).toEqual([LONG_ERROR]);
  });

  it("confirms the copy to the user", async () => {
    const clipboard = stubClipboard();
    cleanups.push(clipboard.restore);
    renderToast("destructive");

    await userEvent.click(screen.getByRole("button", { name: "Copy message" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("leaves non-error toasts alone", () => {
    const clipboard = stubClipboard();
    cleanups.push(clipboard.restore);
    renderToast("default");

    expect(screen.queryByRole("button", { name: "Copy message" })).toBeNull();
  });

  it("hides the button when the clipboard is unavailable over plain http", () => {
    cleanups.push(removeClipboard());
    renderToast("destructive");

    expect(screen.queryByRole("button", { name: "Copy message" })).toBeNull();
  });

  it("keeps the close button alongside it", () => {
    const clipboard = stubClipboard();
    cleanups.push(clipboard.restore);
    const { container } = renderToast("destructive");

    expect(screen.getByRole("button", { name: "Copy message" })).toBeTruthy();
    // Queried by attribute because ToastClose renders a bare icon with no
    // accessible name.
    expect(container.querySelector("[toast-close]")).toBeTruthy();
  });
});
