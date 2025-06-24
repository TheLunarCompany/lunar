import { CardTitle } from "@/components/ui/card";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardTabName } from "@/store";

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
];

export const TabsToolbar = () => {
  return (
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-bold text-[var(--color-text-primary)]">
        <TabsList className="inline-flex items-center gap-1.5">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.name}
              value={tab.name}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] data-[state=active]:bg-[var(--color-fg-interactive)] data-[state=active]:text-[var(--color-text-primary-inverted)] data-[state=active]:shadow"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </CardTitle>
    </div>
  );
};
