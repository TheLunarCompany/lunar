import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/components/ui/use-toast";
import { Toaster } from "./toaster";

const meta = {
  title: "Components/UI/Toaster",
  component: Toaster,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

function ToastDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button
        onClick={() =>
          toast({
            title: "MCP server connected",
            description: "Filesystem tools are now available.",
            position: "bottom-left",
          })
        }
      >
        Default
      </Button>
      <Button
        onClick={() =>
          toast({
            title: "Pending authorization",
            description: "Complete authentication before using this tool.",
            variant: "warning",
            position: "bottom-left",
          })
        }
      >
        Warning
      </Button>
      <Button
        onClick={() =>
          toast({
            title: "Server details updated",
            description: "Changes were saved to your MCP configuration.",
            variant: "server-info",
            position: "bottom-left",
          })
        }
      >
        Server Info
      </Button>
      <Button
        onClick={() =>
          toast({
            title: "Connection failed",
            description: "Check the server URL and try again.",
            variant: "destructive",
            position: "bottom-left",
          })
        }
      >
        Destructive
      </Button>
      <Toaster />
    </div>
  );
}

export const Variants: Story = {
  render: () => <ToastDemo />,
};

export const WithAction: Story = {
  render: () => (
    <div className="flex items-center justify-center">
      <Button
        onClick={() =>
          toast({
            title: "Tool group archived",
            description: "The group was removed from active access controls.",
            variant: "info",
            position: "bottom-left",
            action: (
              <ToastAction altText="Undo archived tool group">Undo</ToastAction>
            ),
          })
        }
      >
        Show action toast
      </Button>
      <Toaster />
    </div>
  ),
};

export const Positions: Story = {
  render: () => (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {(
        [
          "top-center",
          "top-right",
          "bottom-center",
          "bottom-right",
          "bottom-left",
        ] as const
      ).map((position) => (
        <Button
          key={position}
          variant="outline"
          onClick={() =>
            toast({
              title: "Toast position",
              description: position,
              variant: "info",
              position,
            })
          }
        >
          {position}
        </Button>
      ))}
      <Toaster />
    </div>
  ),
};
