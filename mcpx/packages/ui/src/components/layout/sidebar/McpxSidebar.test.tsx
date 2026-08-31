import { Gauge } from "lucide-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { useFeatureFlags } from "@/contexts/feature-flags";
import { McpxSidebar, SidebarAvatar, SidebarBrand } from "./McpxSidebar";

const harness = vi.hoisted(() => ({ skillsFeatureEnabled: true }));

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length(): number {
      return values.size;
    },
    clear(): void {
      values.clear();
    },
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      values.delete(key);
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
  };
}

vi.mock("@/data/skills", () => ({
  useSkillsFeatureEnabled: () => ({ data: harness.skillsFeatureEnabled }),
}));

vi.mock("@/config/runtime-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/config/runtime-config")>();

  return {
    ...actual,
    getRuntimeConfigSync: () => ({
      ...actual.getRuntimeConfigSync(),
      VITE_ENABLE_PERMISSIONS: "false",
      VITE_ENABLE_CAPABILITIES_UI: "false",
      VITE_UI_SIDEBAR_RESTRUCTURE: "false",
      VITE_SHOW_MCP_SERVERS: "false",
    }),
  };
});

function FeatureFlagSidebarHarness(): React.JSX.Element {
  const { setFeatureFlagOverride } = useFeatureFlags();

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setFeatureFlagOverride("VITE_ENABLE_CAPABILITIES_UI", true)
        }
      >
        Enable capabilities
      </button>
      <TooltipProvider>
        <SidebarProvider>
          <McpxSidebar />
        </SidebarProvider>
      </TooltipProvider>
    </>
  );
}

beforeEach(() => {
  harness.skillsFeatureEnabled = true;
  vi.stubEnv("DEV", true);
  vi.stubGlobal("localStorage", createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe("SidebarBrand", () => {
  it("renders the configured brand title and subtitle", () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarBrand title="MCPX USER" subtitle="by lunar.dev" />
      </MemoryRouter>,
    );

    expect(container.textContent).toContain("MCPX USER");
    expect(container.textContent).toContain("by lunar.dev");
  });
});

describe("SidebarAvatar", () => {
  it("renders fallback initials when no image is provided", () => {
    const { container } = render(
      <MemoryRouter>
        <SidebarAvatar name="Amir Developer" />
      </MemoryRouter>,
    );

    const avatar = container.querySelector('[aria-label="Amir Developer"]');
    expect(avatar?.textContent).toBe("AD");
  });
});

describe("McpxSidebar", () => {
  it("updates feature-gated navigation when an override changes", async () => {
    const user = userEvent.setup();
    harness.skillsFeatureEnabled = false;
    render(
      <MemoryRouter>
        <FeatureFlagsProvider>
          <FeatureFlagSidebarHarness />
        </FeatureFlagsProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("link", { name: "Capabilities" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Enable capabilities" }),
    );

    expect(
      screen.getByRole("link", { name: "Capabilities" }),
    ).toBeInTheDocument();
  });

  it("uses the Skills-enabled default sections when sections are omitted", () => {
    render(
      <MemoryRouter>
        <FeatureFlagsProvider>
          <TooltipProvider>
            <SidebarProvider>
              <McpxSidebar />
            </SidebarProvider>
          </TooltipProvider>
        </FeatureFlagsProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Skills" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Tools" }),
    ).not.toBeInTheDocument();
  });

  it("renders sections and highlights the active item", () => {
    const { container } = render(
      <MemoryRouter>
        <FeatureFlagsProvider>
          <TooltipProvider>
            <SidebarProvider>
              <McpxSidebar
                activeItemId="dashboard"
                sections={[
                  {
                    title: "Workspace",
                    items: [
                      {
                        id: "dashboard",
                        label: "Dashboard",
                        icon: Gauge,
                        url: "/dashboard",
                      },
                      {
                        id: "debugger",
                        label: "Debugger",
                        icon: Gauge,
                        disabled: true,
                      },
                    ],
                  },
                ]}
              >
                <div data-testid="footer">Footer</div>
              </McpxSidebar>
            </SidebarProvider>
          </TooltipProvider>
        </FeatureFlagsProvider>
      </MemoryRouter>,
    );

    expect(container.textContent).toContain("Workspace");
    expect(container.textContent).toContain("Dashboard");
    expect(container.textContent).toContain("Debugger");
    expect(container.textContent).toContain("Footer");

    const activeButton = container.querySelector(
      '[data-slot="sidebar-menu-button"][data-active="true"]',
    );
    expect(activeButton?.textContent).toContain("Dashboard");

    const disabledButton = Array.from(
      container.querySelectorAll('[data-slot="sidebar-menu-button"]'),
    ).find((el) => el.textContent?.includes("Debugger"));
    expect(disabledButton?.hasAttribute("disabled")).toBe(true);
  });
});
