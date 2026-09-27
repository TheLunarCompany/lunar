import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Bot, Server } from "lucide-react";
import { NodeCard } from "./node-card";
import { NodeBadge } from "./node-badge";
import { Button } from "@/components/ui/button";
import { NodeCardIcon } from "./node-card-icon";
import { NodeIndicatorBadge } from "./node-indicator-badge";

/* ------------------------------------------------------------------ */
/*  NodeCard                                                          */
/* ------------------------------------------------------------------ */
const cardMeta: Meta<typeof NodeCard> = {
  title: "Components/NodeCard/NodeCard",
  component: NodeCard,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "zero", "warning", "info", "error", "disabled"],
    },
    state: {
      control: "select",
      options: ["default", "active"],
    },
  },
};

export default cardMeta;
type Story = StoryObj<typeof cardMeta>;

/* ---------- Zero Cards ---------- */

export const ZeroDefault: Story = {
  name: "Zero / Default",
  render: () => (
    <NodeCard variant="zero" className="w-[230px] items-center gap-3 py-6">
      <Bot className="size-[30px] text-[var(--colors-primary-500)]" />
      <div className="flex flex-col items-center gap-1 text-sm">
        <span className="font-semibold text-[var(--colors-gray-950)]">
          No AI Agent
        </span>
        <span className="text-[var(--colors-gray-600)]">
          Waiting for agent connection
        </span>
      </div>
      <Button variant="node-card">
        <Plus data-icon="inline-start" />
        Add Agent
      </Button>
    </NodeCard>
  ),
};

export const ZeroActive: Story = {
  name: "Zero / Active",
  render: () => (
    <NodeCard
      variant="zero"
      state="active"
      className="w-[230px] items-center gap-3 py-6"
    >
      <Bot className="size-[30px] text-[var(--colors-primary-500)]" />
      <div className="flex flex-col items-center gap-0.5 text-sm">
        <span className="font-semibold text-[var(--colors-gray-950)]">
          No AI Agent
        </span>
        <span className="text-[var(--colors-gray-600)]">
          Waiting for agent connection
        </span>
      </div>
      <Button variant="node-card">
        <Plus data-icon="inline-start" />
        Add Agent
      </Button>
    </NodeCard>
  ),
};

export const ZeroAllStates: Story = {
  name: "Zero / All States",
  render: () => (
    <div className="flex gap-8">
      {(["default", "active"] as const).map((state) => (
        <div key={state} className="flex flex-col gap-4">
          <span className="border-b border-[#e9e9e9] pb-2 text-xs font-medium uppercase text-black">
            {state}
          </span>
          <NodeCard
            variant="zero"
            state={state}
            className="w-[230px] items-center gap-3 py-6"
          >
            <Bot className="size-[30px] text-[var(--colors-primary-500)]" />
            <div className="flex flex-col items-center gap-1 text-sm">
              <span className="font-semibold text-[var(--colors-gray-950)]">
                No AI Agent
              </span>
              <span className="text-[var(--colors-gray-600)]">
                Waiting for agent connection
              </span>
            </div>
            <Button variant="node-card">
              <Plus data-icon="inline-start" />
              Add Agent
            </Button>
          </NodeCard>
        </div>
      ))}
    </div>
  ),
};

/* ---------- Regular Cards ---------- */

export const RegularAllStates: Story = {
  name: "Regular / All States",
  render: () => (
    <div className="flex gap-8">
      {(["default", "active"] as const).map((state) => (
        <div key={state} className="flex flex-col gap-4">
          <span className="border-b border-[#e9e9e9] pb-2 text-xs font-medium uppercase text-black">
            {state}
          </span>
          <NodeCard variant="default" state={state} className="w-[230px]">
            <div className="flex gap-3 items-center">
              <NodeCardIcon>
                <Bot className="size-[30px] text-[var(--colors-primary-500)]" />
              </NodeCardIcon>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-[var(--colors-gray-950)]">
                  Claude
                </span>
                <NodeBadge>Claude</NodeBadge>
              </div>
            </div>
          </NodeCard>
        </div>
      ))}
    </div>
  ),
};

/* ---------- Warning Cards ---------- */

export const WarningAllStates: Story = {
  name: "Warning / All States",
  render: () => (
    <div className="flex gap-8">
      {(["default", "active"] as const).map((state) => (
        <div key={state} className="flex flex-col gap-4">
          <span className="border-b border-[#e9e9e9] pb-2 text-xs font-medium uppercase text-black">
            {state}
          </span>
          <NodeCard variant="warning" state={state} className="w-[230px] gap-2">
            <NodeIndicatorBadge variant="warning" />
            <div className="flex gap-3 items-center">
              <NodeCardIcon>
                <Server className="size-[30px] text-[var(--colors-gray-500)]" />
              </NodeCardIcon>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-[var(--colors-gray-950)]">
                  Slack
                </span>
                <NodeBadge variant="warning">Pending user input</NodeBadge>
              </div>
            </div>
            <Button variant="node-card" className="w-full">
              <Plus data-icon="inline-start" />
              Insert input
            </Button>
          </NodeCard>
        </div>
      ))}
    </div>
  ),
};

/* ---------- Info Cards ---------- */

export const InfoAllStates: Story = {
  name: "Info / All States",
  render: () => (
    <div className="flex gap-8">
      {(["default", "active"] as const).map((state) => (
        <div key={state} className="flex flex-col gap-4">
          <span className="border-b border-[#e9e9e9] pb-2 text-xs font-medium uppercase text-black">
            {state}
          </span>
          <NodeCard variant="info" state={state} className="w-[230px] gap-2">
            <NodeIndicatorBadge variant="info" />
            <div className="flex gap-3 items-center">
              <NodeCardIcon>
                <Server className="size-[30px] text-[var(--colors-info-500)]" />
              </NodeCardIcon>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-[var(--colors-gray-950)]">
                  Memory
                </span>
                <NodeBadge variant="info">Pending auth</NodeBadge>
              </div>
            </div>
            <Button variant="node-card" className="w-full">
              Get access
            </Button>
          </NodeCard>
        </div>
      ))}
    </div>
  ),
};

/* ---------- Error Cards ---------- */

export const ErrorAllStates: Story = {
  name: "Error / All States",
  render: () => (
    <div className="flex gap-8">
      {(["default", "active"] as const).map((state) => (
        <div key={state} className="flex flex-col gap-4">
          <span className="border-b border-[#e9e9e9] pb-2 text-xs font-medium uppercase text-black">
            {state}
          </span>
          <NodeCard variant="error" state={state} className="w-[230px] gap-2">
            <NodeIndicatorBadge variant="error" />
            <div className="flex gap-3 items-center">
              <NodeCardIcon>
                <Server className="size-[30px] text-[var(--colors-error-700)]" />
              </NodeCardIcon>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-[var(--colors-gray-950)]">
                  Context7
                </span>
                <NodeBadge variant="error">Connection error</NodeBadge>
              </div>
            </div>
          </NodeCard>
        </div>
      ))}
    </div>
  ),
};

/* ---------- All Variants Overview ---------- */

export const AllVariants: Story = {
  name: "All Variants Overview",
  render: () => (
    <div className="flex flex-col gap-12">
      {/* Zero */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-normal">Zero Cards</h3>
        <div className="flex gap-8">
          {(["default", "active"] as const).map((state) => (
            <NodeCard
              key={state}
              variant="zero"
              state={state}
              className="w-[230px] items-center gap-3 py-6"
            >
              <Bot className="size-[30px] text-[var(--colors-primary-500)]" />
              <div className="flex flex-col items-center gap-1 text-sm">
                <span className="font-semibold text-[var(--colors-gray-950)]">
                  No AI Agent
                </span>
                <span className="text-[var(--colors-gray-600)]">
                  Waiting for agent connection
                </span>
              </div>
              <Button variant="node-card">
                <Plus data-icon="inline-start" />
                Add Agent
              </Button>
            </NodeCard>
          ))}
        </div>
      </div>

      {/* Regular */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-normal">Regular Cards</h3>
        <div className="flex gap-8">
          {(["default", "active"] as const).map((state) => (
            <NodeCard
              key={state}
              variant="default"
              state={state}
              className="w-[230px]"
            >
              <div className="flex gap-3 items-center">
                <NodeCardIcon>
                  <Bot className="size-[30px] text-[var(--colors-primary-500)]" />
                </NodeCardIcon>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-[var(--colors-gray-950)]">
                    Claude
                  </span>
                  <NodeBadge>Claude</NodeBadge>
                </div>
              </div>
            </NodeCard>
          ))}
        </div>
      </div>

      {/* Warning */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-normal">Warning Cards</h3>
        <div className="flex gap-8">
          {(["default", "active"] as const).map((state) => (
            <NodeCard
              key={state}
              variant="warning"
              state={state}
              className="w-[230px] gap-2"
            >
              <NodeIndicatorBadge variant="warning" />
              <div className="flex gap-3 items-center">
                <NodeCardIcon>
                  <Server className="size-[30px] text-[var(--colors-gray-500)]" />
                </NodeCardIcon>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-[var(--colors-gray-950)]">
                    Slack
                  </span>
                  <NodeBadge variant="warning">Pending user input</NodeBadge>
                </div>
              </div>
              <Button variant="node-card" className="w-full">
                <Plus data-icon="inline-start" />
                Insert input
              </Button>
            </NodeCard>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-normal">Info Cards</h3>
        <div className="flex gap-8">
          {(["default", "active"] as const).map((state) => (
            <NodeCard
              key={state}
              variant="info"
              state={state}
              className="w-[230px] gap-2"
            >
              <NodeIndicatorBadge variant="info" />
              <div className="flex gap-3 items-center">
                <NodeCardIcon>
                  <Server className="size-[30px] text-[var(--colors-info-500)]" />
                </NodeCardIcon>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-[var(--colors-gray-950)]">
                    Memory
                  </span>
                  <NodeBadge variant="info">Pending auth</NodeBadge>
                </div>
              </div>
              <Button variant="node-card" className="w-full">
                Get access
              </Button>
            </NodeCard>
          ))}
        </div>
      </div>

      {/* Error */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-normal">Error Cards</h3>
        <div className="flex gap-8">
          {(["default", "active"] as const).map((state) => (
            <NodeCard
              key={state}
              variant="error"
              state={state}
              className="w-[230px] gap-2"
            >
              <NodeIndicatorBadge variant="error" />
              <div className="flex gap-3 items-center">
                <NodeCardIcon>
                  <Server className="size-[30px] text-[var(--colors-error-700)]" />
                </NodeCardIcon>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-[var(--colors-gray-950)]">
                    Context7
                  </span>
                  <NodeBadge variant="error">Connection error</NodeBadge>
                </div>
              </div>
            </NodeCard>
          ))}
        </div>
      </div>
    </div>
  ),
};
