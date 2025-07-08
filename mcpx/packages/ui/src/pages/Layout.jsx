import ConfigurationImportModal from "@/components/dashboard/ConfigurationImportModal";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TitlePhrase } from "@/components/ui/title-phrase";
import { useUpdateAppConfig } from "@/data/app-config";
import { useModalsStore, useSocketStore } from "@/store";
import { createPageUrl } from "@/utils";
import { Network, Settings, Shield } from "lucide-react";
import React, { useCallback } from "react";
import { Link, useLocation } from "react-router-dom";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("dashboard"),
    icon: Network,
  },
  {
    title: "Access Controls",
    url: createPageUrl("access-controls"),
    icon: Shield,
  },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { closeConfigModal, isConfigModalOpen, openConfigModal } =
    useModalsStore((s) => ({
      closeConfigModal: s.closeConfigModal,
      isConfigModalOpen: s.isConfigModalOpen,
      openConfigModal: s.openConfigModal,
    }));

  const { serializedAppConfig, systemState } = useSocketStore((s) => ({
    serializedAppConfig: s.serializedAppConfig,
    systemState: s.systemState,
  }));

  // Pass configuration and modal trigger to children
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        importedConfiguration: systemState,
        onRequestNewConfigurationUpload: openConfigModal,
      });
    }
    return child;
  });

  const { mutateAsync: updateAppConfigAsync } = useUpdateAppConfig();

  const handleAppConfigImport = useCallback(
    async ({ appConfig }) => {
      await updateAppConfigAsync(appConfig);
      closeConfigModal();
    },
    [closeConfigModal, updateAppConfigAsync],
  );

  return (
    <>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-[var(--color-bg-app)]">
          <Sidebar className="border-r border-[var(--color-border-primary)] bg-[var(--color-bg-container)]">
            <SidebarHeader className="border-b border-[var(--color-border-primary)] p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-fg-interactive)] to-[var(--color-fg-primary-accent)] rounded-xl flex items-center justify-center">
                  <Network className="w-6 h-6 text-[var(--color-text-primary-inverted)]" />
                </div>
                <div className="select-none">
                  <TitlePhrase>
                    <h2 className="font-bold text-[var(--color-text-primary)] text-lg">
                      MCPX
                    </h2>
                  </TitlePhrase>
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
                        className="w-full text-[var(--color-fg-interactive)] bg-[var(--color-bg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] transition-colors duration-200 rounded-lg mb-1 p-0"
                      >
                        <div className="flex items-center gap-3 px-3 py-1.5">
                          <Settings className="w-5 h-5" />
                          <span>Edit Configuration</span>
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
      {isConfigModalOpen && (
        <ConfigurationImportModal
          isOpen={isConfigModalOpen}
          onClose={closeConfigModal}
          onConfigurationImport={handleAppConfigImport}
          currentAppConfigYaml={serializedAppConfig.yaml}
          currentMcpConfig={systemState}
        />
      )}
    </>
  );
}
