import type { Meta, StoryObj } from "@storybook/react-vite";
import AgentConnectionIcon from "./AgentConnectionIcon";
import AgentsNavigationIcon from "./AgentsNavigationIcon";
import CircleMetricIcon from "./CircleMetricIcon";
import DashboardNavigationIcon from "./DashboardNavigationIcon";
import DatabaseIcon from "./DatabaseIcon";
import GitBranchIcon from "./GitBranchIcon";
import HammerIcon from "./HammerIcon";

function IconGallery() {
  const icons = [
    { name: "AgentConnectionIcon", Component: AgentConnectionIcon },
    { name: "AgentsNavigationIcon", Component: AgentsNavigationIcon },
    { name: "CircleMetricIcon", Component: CircleMetricIcon },
    { name: "DashboardNavigationIcon", Component: DashboardNavigationIcon },
    { name: "DatabaseIcon", Component: DatabaseIcon },
    { name: "GitBranchIcon", Component: GitBranchIcon },
    { name: "HammerIcon", Component: HammerIcon },
  ];

  return (
    <div className="grid grid-cols-4 gap-8 p-4">
      {icons.map(({ name, Component }) => (
        <div
          key={name}
          className="flex flex-col items-center gap-3 p-4 border rounded-lg"
        >
          <Component width={48} height={48} />
          <span className="text-xs text-gray-600 font-mono">{name}</span>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: "Icons/AllIcons",
  component: IconGallery,
} satisfies Meta<typeof IconGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {};

export const AgentConnection: Story = {
  render: () => (
    <div className="flex gap-4 items-end">
      <AgentConnectionIcon width={24} height={24} />
      <AgentConnectionIcon width={36} height={36} color="#4078c0" />
      <AgentConnectionIcon width={48} height={48} color="#e34c26" />
    </div>
  ),
};

export const Database: Story = {
  render: () => (
    <div className="flex gap-4 items-end">
      <DatabaseIcon width={24} height={24} />
      <DatabaseIcon width={36} height={36} color="#4078c0" />
      <DatabaseIcon width={48} height={48} color="#e34c26" />
    </div>
  ),
};

export const Navigation: Story = {
  render: () => (
    <div className="flex gap-6 items-end">
      <div className="flex flex-col items-center gap-1">
        <DashboardNavigationIcon width={32} height={32} />
        <span className="text-xs">Dashboard</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <AgentsNavigationIcon width={32} height={32} />
        <span className="text-xs">Agents</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <HammerIcon width={32} height={32} />
        <span className="text-xs">Tools</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <GitBranchIcon width={32} height={32} />
        <span className="text-xs">Git</span>
      </div>
    </div>
  ),
};

export const Metrics: Story = {
  render: () => (
    <div className="flex gap-4 items-end">
      <CircleMetricIcon width={24} height={24} />
      <CircleMetricIcon width={36} height={36} fill="#22c55e" />
      <CircleMetricIcon width={48} height={48} fill="#ef4444" />
    </div>
  ),
};
