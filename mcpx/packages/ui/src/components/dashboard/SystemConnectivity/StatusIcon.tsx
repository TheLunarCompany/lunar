import { CheckCircle2, Clock, Loader2, Lock, XCircle } from "lucide-react";

export const StatusIcon = ({
  status,
  size = "w-2.5 h-2.5",
}: {
  status: string;
  size?: string;
}) => {
  const icons = {
    connecting: (
      <Loader2
        className={`${size} text-(--color-text-secondary) animate-spin`}
      />
    ),
    connected: <CheckCircle2 className={`${size} text-(--color-fg-success)`} />,
    connected_running: (
      <CheckCircle2 className={`${size} text-(--color-fg-success)`} />
    ),
    connected_stopped: (
      <CheckCircle2 className={`${size} text-(--color-fg-info)`} />
    ),
    disconnected: (
      <XCircle className={`${size} text-(--color-text-disabled)`} />
    ),
    error: <XCircle className={`${size} text-(--color-fg-danger)`} />,
    running: <CheckCircle2 className={`${size} text-(--color-fg-success)`} />,
    stopped: <CheckCircle2 className={`${size} text-(--color-fg-info)`} />,
    pending_auth: <Lock className={`${size} text-(--color-fg-info)`} />,
  };
  return (
    icons[status as keyof typeof icons] || (
      <Clock className={`${size} text-(--color-fg-warning)`} />
    )
  );
};
