import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  Link,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnsavedChangesPrompt } from "./useUnsavedChangesPrompt";

describe("useUnsavedChangesPrompt", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn());
  });

  it("does not prompt when clean", async () => {
    const user = userEvent.setup();
    renderRouter({ isDirty: false });

    await user.click(screen.getByRole("link", { name: "Other" }));

    expect(window.confirm).not.toHaveBeenCalled();
    expect(await screen.findByText("Other page")).toBeInTheDocument();
  });

  it("blocks in-app navigation when dirty and the user cancels", async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValue(false);
    renderRouter({ isDirty: true });

    await user.click(screen.getByRole("link", { name: "Other" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "You have unsaved changes. Leave without saving?",
    );
    expect(screen.getByText("Editor page")).toBeInTheDocument();
  });

  it("proceeds with in-app navigation when dirty and the user confirms", async () => {
    const user = userEvent.setup();
    vi.mocked(window.confirm).mockReturnValue(true);
    renderRouter({ isDirty: true });

    await user.click(screen.getByRole("link", { name: "Other" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText("Other page")).toBeInTheDocument();
  });

  it("registers beforeunload when dirty", () => {
    renderRouter({ isDirty: true });
    const event = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("allows the next programmatic navigation without prompting", async () => {
    const user = userEvent.setup();
    renderRouter({ isDirty: true });

    await user.click(screen.getByRole("button", { name: "Save and leave" }));

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("Other page")).toBeInTheDocument(),
    );
  });
});

function renderRouter({ isDirty }: { isDirty: boolean }) {
  const router = createMemoryRouter(
    [
      {
        path: "/edit",
        element: <Editor isDirty={isDirty} />,
      },
      {
        path: "/other",
        element: <div>Other page</div>,
      },
    ],
    { initialEntries: ["/edit"] },
  );

  return render(<RouterProvider router={router} />);
}

function Editor({ isDirty }: { isDirty: boolean }) {
  const navigate = useNavigate();
  const { allowNextNavigation } = useUnsavedChangesPrompt(isDirty);

  return (
    <div>
      <p>Editor page</p>
      <Link to="/other">Other</Link>
      <button
        type="button"
        onClick={() => {
          allowNextNavigation();
          navigate("/other");
        }}
      >
        Save and leave
      </button>
    </div>
  );
}
