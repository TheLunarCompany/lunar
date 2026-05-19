import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionManager } from "./ConnectionManager";

const connect = vi.fn();
const disconnect = vi.fn();

vi.mock("@/contexts/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    loginRequired: false,
  }),
}));

vi.mock("@/store", () => ({
  useSocketStore: (
    selector: (state: {
      connect: typeof connect;
      disconnect: typeof disconnect;
    }) => unknown,
  ) => selector({ connect, disconnect }),
}));

describe("ConnectionManager", () => {
  it("does not connect when disabled", () => {
    render(<ConnectionManager enabled={false} />);

    expect(connect).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });
});
