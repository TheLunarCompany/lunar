import type { Meta, StoryObj } from "@storybook/react-vite";
import NoServers from "./NoServers";
import { withSocketStore, withQueryClient } from "@/stories/decorators";
import { MemoryRouter } from "react-router-dom";

const meta = {
  title: "Dashboard/Diagram/NoServers",
  component: NoServers,
  decorators: [
    withSocketStore(),
    withQueryClient,
    (Story) => (
      <MemoryRouter>
        <div style={{ width: 300, padding: 24 }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof NoServers>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
