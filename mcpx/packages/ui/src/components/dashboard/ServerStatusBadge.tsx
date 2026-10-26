import {
  SemanticBadge,
  type SemanticBadgeProps,
  type SemanticBadgeTone,
} from "@/components/ui/semantic-badge";
import { McpServerStatus } from "@/types";

type ServerStatusBadgeStatus = McpServerStatus | "disabled";

const SERVER_STATUS_TONES: Record<ServerStatusBadgeStatus, SemanticBadgeTone> =
  {
    connecting: "neutral",
    disabled: "disabled",
    connected_running: "success",
    connected_stopped: "success",
    connected_inactive: "inactive",
    connection_failed: "danger",
    pending_auth: "info",
    pending_input: "pending",
  };

const SERVER_STATUS_LABELS: Record<ServerStatusBadgeStatus, string> = {
  connecting: "Connecting...",
  disabled: "Disabled",
  connected_running: "Active",
  connected_inactive: "Inactive",
  connected_stopped: "Connected",
  connection_failed: "Connection Error",
  pending_auth: "Pending Auth",
  pending_input: "Missing Configuration",
};

type ServerStatusBadgeProps = Omit<
  SemanticBadgeProps,
  "children" | "tone" | "showDot"
> & {
  status: ServerStatusBadgeStatus;
};

export function ServerStatusBadge({
  className,
  status,
  ...props
}: ServerStatusBadgeProps) {
  return (
    <SemanticBadge
      {...props}
      tone={SERVER_STATUS_TONES[status]}
      title={SERVER_STATUS_LABELS[status]}
      className={className}
    >
      {SERVER_STATUS_LABELS[status]}
    </SemanticBadge>
  );
}
