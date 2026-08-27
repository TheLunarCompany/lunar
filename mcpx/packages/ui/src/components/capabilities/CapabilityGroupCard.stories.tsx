import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { Eye, FilePenLine, Trash2, Wrench } from "lucide-react";
import { CapabilityGroupCard } from "./CapabilityGroupCard";

const providers = [
  { name: "GitHub", toolsNumber: 8 },
  { name: "Playwright", toolsNumber: 11 },
  { name: "Slack", toolsNumber: 4 },
  { name: "Figma", toolsNumber: 6 },
  { name: "Notion", toolsNumber: 2 },
  { name: "Docker", toolsNumber: 7 },
  { name: "Grafana", toolsNumber: 9 },
  { name: "Sentry", toolsNumber: 3 },
  { name: "Redis", toolsNumber: 5 },
  { name: "Postgres", toolsNumber: 4 },
  { name: "Jira", toolsNumber: 6 },
  { name: "Linear", toolsNumber: 2 },
];

const meta = {
  title: "Capabilities/CapabilityGroupCard",
  component: CapabilityGroupCard,
  args: {
    onClick: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-[240px] bg-[var(--colors-white)] p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapabilityGroupCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function ExampleCard({
  title = "Browser automation & UI testing",
  visibleProviders = providers.slice(0, 3),
  hiddenProvidersCount = providers.length - 3,
  toolsCount = 24,
  promptsCount = 2,
  resourcesCount = 75,
}: {
  title?: string;
  visibleProviders?: Array<{ name: string; toolsNumber: number }>;
  hiddenProvidersCount?: number;
  toolsCount?: number;
  promptsCount?: number;
  resourcesCount?: number;
}) {
  return (
    <CapabilityGroupCard>
      <CapabilityGroupCard.Header>
        <CapabilityGroupCard.Icon />
        <CapabilityGroupCard.Title>{title}</CapabilityGroupCard.Title>
        <CapabilityGroupCard.Menu>
          <CapabilityGroupCard.MenuButton />
          <CapabilityGroupCard.MenuContent>
            <CapabilityGroupCard.MenuItem onSelect={fn()}>
              <Eye />
              Details
            </CapabilityGroupCard.MenuItem>
            <CapabilityGroupCard.MenuItem onSelect={fn()}>
              <FilePenLine />
              Edit Tool Group
            </CapabilityGroupCard.MenuItem>
            <CapabilityGroupCard.MenuItem onSelect={fn()}>
              <Wrench />
              Update Tools
            </CapabilityGroupCard.MenuItem>
            <CapabilityGroupCard.MenuItem variant="destructive" onSelect={fn()}>
              <Trash2 />
              Delete
            </CapabilityGroupCard.MenuItem>
          </CapabilityGroupCard.MenuContent>
        </CapabilityGroupCard.Menu>
      </CapabilityGroupCard.Header>

      <CapabilityGroupCard.Providers>
        {visibleProviders.map((provider) => (
          <CapabilityGroupCard.ProviderBadge
            key={provider.name}
            name={provider.name}
            toolsNumber={provider.toolsNumber}
          />
        ))}
        <CapabilityGroupCard.MoreProviders count={hiddenProvidersCount} />
      </CapabilityGroupCard.Providers>

      <CapabilityGroupCard.Divider />

      <CapabilityGroupCard.Metrics>
        <CapabilityGroupCard.ToolsMetric value={toolsCount} />
        <CapabilityGroupCard.PromptsMetric value={promptsCount} />
        <CapabilityGroupCard.ResourcesMetric value={resourcesCount} />
      </CapabilityGroupCard.Metrics>
    </CapabilityGroupCard>
  );
}

export const Default: Story = {
  render: () => <ExampleCard />,
};

export const FewProviders: Story = {
  render: () => (
    <ExampleCard
      visibleProviders={[
        { name: "GitHub", toolsNumber: 5 },
        { name: "Playwright", toolsNumber: 3 },
      ]}
      hiddenProvidersCount={0}
      toolsCount={8}
      promptsCount={1}
      resourcesCount={12}
    />
  ),
};

export const LongTitle: Story = {
  render: () => (
    <ExampleCard title="Browser automation, visual regression, accessibility, and UI testing" />
  ),
};
