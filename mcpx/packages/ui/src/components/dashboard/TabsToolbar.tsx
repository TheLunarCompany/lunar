import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardTabName, useDashboardStore, useModalsStore } from "@/store";
import { Plus } from "lucide-react";

const TABS = [
  {
    name: DashboardTabName.Agents,
    label: "Agents",
  },
  {
    name: DashboardTabName.MCPX,
    label: "MCPX",
  },
  {
    name: DashboardTabName.Servers,
    label: "MCP Servers",
  },
  {
    name: DashboardTabName.Tools,
    label: "Tools",
  },
];

export const TabsToolbar = () => {
  const { openAddServerModal } = useModalsStore((state) => ({
    openAddServerModal: state.openAddServerModal,
  }));
  const { setCurrentTab } = useDashboardStore((s) => ({
    setCurrentTab: s.setCurrentTab,
  }));

  return (
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-bold text-[var(--color-text-primary)]">
        <TabsList className="inline-flex items-center gap-1.5">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.name}
              value={tab.name}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] data-[state=active]:bg-[var(--color-fg-interactive)] data-[state=active]:text-[var(--color-text-primary-inverted)] data-[state=active]:shadow"
              onClick={() =>
                setCurrentTab(tab.name, {
                  setSearch: {
                    agents: "",
                    servers: "",
                  },
                })
              }
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </CardTitle>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          openAddServerModal();
        }}
        className="px-2 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)] focus:bg-[var(--color-bg-interactive-hover)]"
      >
        <Plus className="w-2 h-2 mr-0.5" />
        Add Server
      </Button>
    </div>
  );
};
