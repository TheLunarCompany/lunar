import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout";

vi.mock("@/data/identity", () => ({
  useIdentity: () => ({ data: undefined }),
  useIdentityLiveSync: () => {},
  getSpaceEditedByLabel: () => undefined,
  getSpaceKindLabel: () => "space",
  getSpaceName: () => undefined,
}));

vi.mock("@/components/dashboard/AddServerModal", () => ({
  AddServerModal: () => null,
}));

vi.mock("@/components/dashboard/McpxConfigError", () => ({
  McpxConfigError: ({ message }: { message: string | null }) => (
    <div>{message}</div>
  ),
}));

vi.mock("@/components/dashboard/McpxNotConnected", () => ({
  McpxNotConnected: () => <div>Not connected</div>,
}));

vi.mock("@/components/dashboard/ServerDetailsModal", () => ({
  ServerDetailsModal: () => null,
}));

vi.mock("@/components/ProvisioningScreen", () => ({
  ProvisioningScreen: () => <div>Provisioning</div>,
}));

vi.mock("@/components/ui/McpRemoteWarningBanner", () => ({
  McpRemoteWarningBanner: () => null,
}));

vi.mock("@/components/UserDetails", () => ({
  UserDetails: () => null,
}));

vi.mock("@/contexts/useAuth", () => ({
  useAuth: () => ({
    user: null,
    loginRequired: false,
    login: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMcpxConnection", () => ({
  useMcpxConnection: vi.fn(),
}));

vi.mock("@/store", () => ({
  useModalsStore: (
    selector: (state: {
      closeAddServerModal: () => void;
      isAddServerModalOpen: boolean;
      closeConfigModal: () => void;
      isConfigModalOpen: boolean;
      openConfigModal: () => void;
      closeServerDetailsModal: () => void;
      isServerDetailsModalOpen: boolean;
      selectedServerName: null;
    }) => unknown,
  ) =>
    selector({
      closeAddServerModal: vi.fn(),
      isAddServerModalOpen: false,
      closeConfigModal: vi.fn(),
      isConfigModalOpen: false,
      openConfigModal: vi.fn(),
      closeServerDetailsModal: vi.fn(),
      isServerDetailsModalOpen: false,
      selectedServerName: null,
    }),
  useSocketStore: (
    selector: (state: {
      connectError: null;
      connectionRejectedHubRequired: false;
      isConnected: true;
      isPending: false;
      serializedAppConfig: string;
      systemState: { connectedClients: [] };
    }) => unknown,
  ) =>
    selector({
      connectError: null,
      connectionRejectedHubRequired: false,
      isConnected: true,
      isPending: false,
      serializedAppConfig: "{}",
      systemState: { connectedClients: [] },
    }),
}));

describe("Layout", () => {
  it("renders the sidebar and main content in the layout shell", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <TooltipProvider>
          <Layout>
            <div>Page content</div>
          </Layout>
        </TooltipProvider>
      </MemoryRouter>,
    );

    const wrapper = container.querySelector('[data-testid="layout-shell"]');
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    const main = container.querySelector("main");

    expect(wrapper).toBeInTheDocument();
    expect(sidebar).toBeInTheDocument();
    expect(main).toHaveTextContent("Page content");
  });

  it("keeps the Skills nav item active on nested skill routes", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/skills/019f460d-e12d-7be3-92d0-b5893aae6027/capabilities",
        ]}
      >
        <TooltipProvider>
          <Layout>
            <div>Page content</div>
          </Layout>
        </TooltipProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "data-active",
      "false",
    );
  });
});
