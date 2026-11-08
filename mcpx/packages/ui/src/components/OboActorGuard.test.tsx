import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIdentity } from "@/data/identity";
import { OboActorGuard } from "./OboActorGuard";

vi.mock("@/data/identity", () => ({ useIdentity: vi.fn() }));

type IdentityResult = ReturnType<typeof useIdentity>;

function spaceIdentity(edited: boolean): IdentityResult {
  return {
    data: {
      identity: {
        mode: "enterprise",
        entity: {
          entityType: "space",
          editedBy: edited ? { adminDisplayName: "Admin A" } : undefined,
        },
      },
    },
  } as IdentityResult;
}

function userIdentity(editingElsewhere: boolean): IdentityResult {
  return {
    data: {
      identity: {
        mode: "enterprise",
        entity: {
          entityType: "user",
          role: "admin",
          editingOnBehalfOf: editingElsewhere
            ? { spaceName: "Some Space" }
            : undefined,
        },
      },
    },
  } as IdentityResult;
}

describe("OboActorGuard", () => {
  beforeEach(() => {
    vi.mocked(useIdentity).mockReset();
    sessionStorage.clear();
  });

  it("renders nothing and clears the reload flag for a valid space", () => {
    sessionStorage.setItem("obo-actor-guard-reloaded", "1");
    vi.mocked(useIdentity).mockReturnValue(spaceIdentity(true));
    const reload = vi.fn();
    const { container } = render(<OboActorGuard reload={reload} />);
    expect(container).toBeEmptyDOMElement();
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("obo-actor-guard-reloaded")).toBeNull();
  });

  it("does nothing while identity is still loading (keeps the reload flag)", () => {
    sessionStorage.setItem("obo-actor-guard-reloaded", "1");
    vi.mocked(useIdentity).mockReturnValue({
      data: undefined,
    } as IdentityResult);
    const reload = vi.fn();
    const { container } = render(<OboActorGuard reload={reload} />);
    expect(container).toBeEmptyDOMElement();
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("obo-actor-guard-reloaded")).toBe("1");
  });

  it("shows the overlay, then auto-reloads, the first time a space goes stale", () => {
    vi.useFakeTimers();
    vi.mocked(useIdentity).mockReturnValue(spaceIdentity(false));
    const reload = vi.fn();
    render(<OboActorGuard reload={reload} />);
    expect(screen.getByText(/reloading/i)).toBeInTheDocument();
    // Flag is set only as the reload fires, not while the overlay is showing.
    expect(sessionStorage.getItem("obo-actor-guard-reloaded")).toBeNull();
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("obo-actor-guard-reloaded")).toBe("1");
    vi.useRealTimers();
  });

  it("blocks instead of looping when a stale space already reloaded", () => {
    sessionStorage.setItem("obo-actor-guard-reloaded", "1");
    vi.mocked(useIdentity).mockReturnValue(spaceIdentity(false));
    const reload = vi.fn();
    render(<OboActorGuard reload={reload} />);
    expect(screen.getByText(/no longer active/i)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it("auto-reloads a user who started editing a space elsewhere", () => {
    vi.useFakeTimers();
    vi.mocked(useIdentity).mockReturnValue(userIdentity(true));
    const reload = vi.fn();
    render(<OboActorGuard reload={reload} />);
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("does not block or reload a user who is not editing elsewhere", () => {
    vi.mocked(useIdentity).mockReturnValue(userIdentity(false));
    const reload = vi.fn();
    const { container } = render(<OboActorGuard reload={reload} />);
    expect(container).toBeEmptyDOMElement();
    expect(reload).not.toHaveBeenCalled();
  });

  it("manual reload button triggers a reload", () => {
    sessionStorage.setItem("obo-actor-guard-reloaded", "1");
    vi.mocked(useIdentity).mockReturnValue(spaceIdentity(false));
    const reload = vi.fn();
    render(<OboActorGuard reload={reload} />);
    screen.getByRole("button", { name: /reload/i }).click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reset the auto-reload timer across re-renders, and uses the latest reload", () => {
    vi.useFakeTimers();
    vi.mocked(useIdentity).mockReturnValue(spaceIdentity(false));
    // A fresh reload fn per render, as the default closure would be.
    const firstReload = vi.fn();
    const { rerender } = render(<OboActorGuard reload={firstReload} />);
    vi.advanceTimersByTime(700);
    const secondReload = vi.fn();
    rerender(<OboActorGuard reload={secondReload} />);
    // 300ms more = 1000ms from the first mount. If the re-render had re-armed the
    // timer, nothing would fire yet.
    vi.advanceTimersByTime(300);
    expect(firstReload).not.toHaveBeenCalled();
    expect(secondReload).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
