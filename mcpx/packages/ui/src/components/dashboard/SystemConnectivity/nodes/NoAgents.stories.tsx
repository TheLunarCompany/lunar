import type { Meta, StoryObj } from "@storybook/react-vite";
import NoAgents from "./NoAgents";
import { withSocketStore } from "@/stories/decorators";
import { MemoryRouter } from "react-router-dom";

const meta = {
  title: "Dashboard/Diagram/NoAgents",
  component: NoAgents,
  decorators: [
    withSocketStore(),
    (Story) => (
      <MemoryRouter>
        <div style={{ width: 300, padding: 24 }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof NoAgents>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
