import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart3, Network, UploadCloud } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import ConfigurationImportModal from "../components/dashboard/ConfigurationImportModal";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: Network,
  },
  {
    title: "Analytics",
    url: createPageUrl("Analytics"),
    icon: BarChart3,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [currentConfiguration, setCurrentConfiguration] = useState(null);

  const handleConfigurationImport = (configData) => {
    // Only process the MCP config for now
    setCurrentConfiguration(configData.mcpConfig);
    setIsConfigModalOpen(false);
  };

  const openConfigModal = () => {
    setIsConfigModalOpen(true);
  };

  // Pass configuration and modal trigger to children
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        importedConfiguration: currentConfiguration,
        onRequestNewConfigurationUpload: openConfigModal,
      });
    }
    return child;
  });

  return (
    <>
      <style jsx global>{`
        :root {
          --color-bg-app: #f0eef6;
          --color-bg-container: #f9f8fb;
          --color-bg-container-overlay: rgba(218, 212, 247, 0.2);
          --color-bg-modal-overlay: rgba(238, 237, 243, 0.6);
          --color-bg-hover: rgba(251, 2, 150, 0.05);
          --color-bg-interactive: rgba(130, 110, 247, 0.05);
          --color-bg-interactive-hover: rgba(130, 110, 247, 0.07);
          --color-bg-info: rgba(107, 98, 147, 0.1);
          --color-bg-info-hover: rgba(107, 98, 147, 0.15);
          --color-bg-success: rgba(0, 178, 113, 0.1);
          --color-bg-success-hover: rgba(0, 178, 113, 0.15);
          --color-bg-warning: rgba(229, 134, 0, 0.1);
          --color-bg-warning-hover: rgba(229, 134, 0, 0.15);
          --color-bg-danger: rgba(228, 2, 97, 0.1);
          --color-bg-danger-hover: rgba(228, 2, 97, 0.15);
          --color-bg-neutral: rgba(134, 122, 184, 0.2);
          --color-bg-secondary-accent: rgba(2, 177, 172, 0.05);

          --color-fg-interactive: #6147d1;
          --color-fg-interactive-hover: #4f33cc;
          --color-fg-primary-accent: #ca0279;
          --color-fg-secondary-accent: #02b1ac;
          --color-fg-info: #6b6293;
          --color-fg-info-hover: #6b6293;
          --color-fg-success: #00b271;
          --color-fg-success-hover: #00b271;
          --color-fg-warning: #e58600;
          --color-fg-warning-hover: #e58600;
          --color-fg-danger: #e40261;
          --color-fg-danger-hover: #ca0256;

          --color-border-primary: rgba(32, 20, 82, 0.15);
          --color-border-interactive: rgba(79, 51, 204, 0.3);
          --color-border-interactive-hover: rgba(79, 51, 204, 0.5);
          --color-border-info: rgba(107, 98, 147, 0.2);
          --color-border-info-hover: rgba(107, 98, 147, 0.25);
          --color-border-success: rgba(0, 178, 113, 0.2);
          --color-border-success-hover: rgba(0, 178, 113, 0.25);
          --color-border-warning: rgba(229, 134, 0, 0.2);
          --color-border-warning-hover: rgba(229, 134, 0, 0.25);
          --color-border-danger: rgba(228, 2, 97, 0.2);
          --color-border-danger-hover: rgba(228, 2, 97, 0.25);

          --color-text-primary: #231a4d;
          --color-text-primary-inverted: #ffffff;
          --color-text-secondary: #6b6293;
          --color-text-disabled: #c2bddb;

          --color-data-series-1: #30c5cf;
          --color-data-series-2: #0065e5;
          --color-data-series-3: #414cb4;
          --color-data-series-4: #5b19e6;
          --color-data-series-5: #9a3aa1;
          --color-data-series-6: #d8188b;
          --color-data-series-7: #ff280f;
          --color-data-series-8: #ff9200;
        }

        @keyframes pulse-line {
          0% {
            stroke-dashoffset: 20;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .pulsing-line {
          stroke-dasharray: 10 10;
          animation: pulse-line 2.5s linear infinite;
        }
      `}</style>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[var(--color-bg-app)]">
          <Sidebar className="border-r border-[var(--color-border-primary)] bg-[var(--color-bg-container)]">
            <SidebarHeader className="border-b border-[var(--color-border-primary)] p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-fg-interactive)] to-[var(--color-fg-primary-accent)] rounded-xl flex items-center justify-center">
                  <Network className="w-6 h-6 text-[var(--color-text-primary-inverted)]" />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--color-text-primary)] text-lg">
                    MCPX
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                    Control Plane
                  </p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="p-3">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider px-3 py-2">
                  Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] transition-colors duration-200 rounded-lg mb-1 ${
                            location.pathname === item.url
                              ? "bg-[var(--color-bg-interactive)] text-[var(--color-fg-interactive)] font-medium"
                              : "text-[var(--color-text-primary)]"
                          }`}
                        >
                          <Link
                            to={item.url}
                            className="flex items-center gap-3 px-3 py-2.5"
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider px-3 py-2 mt-3">
                  Configuration
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={openConfigModal}
                        className="w-full text-[var(--color-text-primary)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] transition-colors duration-200 rounded-lg mb-1"
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <UploadCloud className="w-5 h-5" />
                          <span>Load New Config</span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 flex flex-col">
            <header className="bg-[var(--color-bg-container)] border-b border-[var(--color-border-primary)] px-6 py-4 md:hidden">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-[var(--color-bg-info-hover)] p-2 rounded-lg transition-colors duration-200 text-[var(--color-text-primary)]" />
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  MCPX Control Plane
                </h1>
              </div>
            </header>

            <div className="flex-1 overflow-auto bg-[var(--color-bg-app)]">
              {childrenWithProps}
            </div>
          </main>
        </div>
      </SidebarProvider>

      <ConfigurationImportModal
        isOpen={isConfigModalOpen}
        onConfigurationImport={handleConfigurationImport}
        onClose={() => setIsConfigModalOpen(false)}
      />
    </>
  );
}
