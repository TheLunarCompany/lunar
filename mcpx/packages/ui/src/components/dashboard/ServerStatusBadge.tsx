import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { McpServerStatus } from "@/types";
import { SERVER_STATUS } from "@/types/mcp-server";
import { cva } from "class-variance-authority";

const serverStatusBadgeVariants = cva(
  "h-[22px] rounded-full border-transparent pl-1.5 pr-2 leading-[18px]",
  {
    variants: {
      status: {
        [SERVER_STATUS.connecting]:
          "bg-(--colors-gray-100) text-(--colors-gray-600)",
        [SERVER_STATUS.connected_running]:
          "bg-(--color-bg-success) text-(--color-fg-success)",
        [SERVER_STATUS.connected_stopped]:
          "bg-(--color-bg-success) text-(--color-fg-success)",
        [SERVER_STATUS.connected_inactive]:
          "bg-(--colors-primary-50) text-(--colors-primary-700)",
        [SERVER_STATUS.connection_failed]:
          "bg-(--colors-error-50) text-(--colors-error-700)",
        [SERVER_STATUS.pending_auth]:
          "bg-(--colors-info-50) text-(--colors-info-700)",
        [SERVER_STATUS.pending_input]:
          "bg-(--colors-warning-100) text-(--colors-warning-500)",
      },
    },
  },
);

const SERVER_STATUS_LABELS: Record<McpServerStatus, string> = {
  connecting: "Connecting...",
  connected_running: "ACTIVE",
  connected_inactive: "Inactive",
  connected_stopped: "Connected",
  connection_failed: "Connection Error",
  pending_auth: "Pending Authentication",
  pending_input: "Missing Configuration",
};

type ServerStatusBadgeProps = Omit<BadgeProps, "children" | "variant"> & {
  status: McpServerStatus;
};

export function ServerStatusBadge({
  className,
  status,
  ...props
}: ServerStatusBadgeProps) {
  return (
    <Badge
      {...props}
      variant="secondary"
      size="md"
      className={cn(serverStatusBadgeVariants({ status }), className)}
    >
      <span className="bg-current w-1.5 h-1.5 rounded-full" aria-hidden />
      {SERVER_STATUS_LABELS[status]}
    </Badge>
  );
}
