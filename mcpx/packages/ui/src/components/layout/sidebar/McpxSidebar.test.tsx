import { Gauge } from "lucide-react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { McpxSidebar, SidebarAvatar, SidebarBrand } from "./McpxSidebar";

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
  it("renders sections and highlights the active item", () => {
    const { container } = render(
      <MemoryRouter>
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
