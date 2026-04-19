import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "@storybook/test";
import { withAppShell } from "@/stories/decorators";
import ConfigurationModal from "./ConfigurationModal";

const sampleYaml = `permissions:
  default:
    _type: default-allow
    block: []
  consumers: {}
toolGroups:
  - name: File Operations
    services:
      my-mcp-server:
        - read_file
        - write_file
`;

const meta = {
  title: "Dashboard/Modals/ConfigurationModal",
  component: ConfigurationModal,
  decorators: [withAppShell],
  args: {
    isOpen: true,
    onClose: fn(),
    onConfigurationImport: fn(),
    currentAppConfigYaml: sampleYaml,
  },
} satisfies Meta<typeof ConfigurationModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyConfig: Story = {
  args: {
    currentAppConfigYaml: "",
  },
};
