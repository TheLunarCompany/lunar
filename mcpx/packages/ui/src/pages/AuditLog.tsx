import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGetAuditLogs } from "@/data/audit-log";
import type { AuditLogEntry, AuditLogEventType } from "@/lib/api";
import { formatDateTimeLong } from "@/utils";
import {
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";

const ALL_EVENT_TYPES: AuditLogEventType[] = [
  "target_server_added",
  "target_server_removed",
  "agent_permission_updated",
  "catalog_updated",
  "tool_used",
  "prompt_used",
];

const EVENT_LABEL: Record<AuditLogEventType, string> = {
  target_server_added: "MCP added",
  target_server_removed: "MCP removed",
  agent_permission_updated: "Agent permission updated",
  catalog_updated: "Catalog updated",
  tool_used: "Tool used",
  prompt_used: "Prompt used",
};

type BadgeVariant = "success" | "danger" | "info" | "outline";

const EVENT_BADGE: Record<
  AuditLogEventType,
  { variant: BadgeVariant; className?: string }
> = {
  target_server_added: { variant: "success" },
  target_server_removed: { variant: "danger" },
  agent_permission_updated: { variant: "info" },
  catalog_updated: {
    variant: "outline",
    className:
      "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800",
  },
  tool_used: {
    variant: "outline",
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800",
  },
  prompt_used: {
    variant: "outline",
    className:
      "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800",
  },
};

const DEFAULT_SELECTED: AuditLogEventType[] = [...ALL_EVENT_TYPES];

function summarize(entry: AuditLogEntry): React.ReactNode {
  switch (entry.eventType) {
    case "target_server_added":
      return (
        <>
          Added MCP server <strong>{entry.payload.name}</strong>
        </>
      );
    case "target_server_removed":
      return (
        <>
          Removed MCP server <strong>{entry.payload.name}</strong>
        </>
      );
    case "agent_permission_updated": {
      const { name, addedServers, removedServers } = entry.payload;
      return (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>
            Agent <strong>{name}</strong> permission changed
          </span>
          {addedServers.length > 0 && (
            <span className="inline-flex items-center gap-1 text-badge-success-fg">
              <Plus className="h-3.5 w-3.5" /> {addedServers.join(", ")}
            </span>
          )}
          {removedServers.length > 0 && (
            <span className="inline-flex items-center gap-1 text-badge-danger-fg">
              <Minus className="h-3.5 w-3.5" /> {removedServers.join(", ")}
            </span>
          )}
        </span>
      );
    }
    case "catalog_updated": {
      const { addedServers, removedServers, approvedToolsChanges } =
        entry.payload;
      return (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>Catalog updated</span>
          {addedServers.length > 0 && (
            <span className="inline-flex items-center gap-1 text-badge-success-fg">
              <Plus className="h-3.5 w-3.5" /> {addedServers.join(", ")}
            </span>
          )}
          {removedServers.length > 0 && (
            <span className="inline-flex items-center gap-1 text-badge-danger-fg">
              <Minus className="h-3.5 w-3.5" /> {removedServers.join(", ")}
            </span>
          )}
          {approvedToolsChanges.map((change) => (
            <span
              key={change.serverName}
              className="inline-flex flex-wrap items-baseline gap-1 text-muted-foreground"
            >
              <strong>{change.serverName}</strong> tools:
              {change.addedTools.length > 0 && (
                <span className="inline-flex items-center gap-1 text-badge-success-fg">
                  <Plus className="h-3 w-3" /> {change.addedTools.join(", ")}
                </span>
              )}
              {change.removedTools.length > 0 && (
                <span className="inline-flex items-center gap-1 text-badge-danger-fg">
                  <Minus className="h-3 w-3" /> {change.removedTools.join(", ")}
                </span>
              )}
            </span>
          ))}
        </span>
      );
    }
    case "tool_used":
      return (
        <>
          Tool <strong>{entry.payload.toolName}</strong> used on{" "}
          <strong>{entry.payload.targetServerName}</strong>
          {entry.payload.consumerTag ? ` by ${entry.payload.consumerTag}` : ""}
        </>
      );
    case "prompt_used":
      return (
        <>
          Prompt <strong>{entry.payload.promptName}</strong> used on{" "}
          <strong>{entry.payload.targetServerName}</strong>
          {entry.payload.consumerTag ? ` by ${entry.payload.consumerTag}` : ""}
        </>
      );
  }
}

export default function AuditLog() {
  const [selectedTypes, setSelectedTypes] =
    useState<AuditLogEventType[]>(DEFAULT_SELECTED);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filter = useMemo(
    () => ({ eventTypes: selectedTypes, limit: 200 }),
    [selectedTypes],
  );

  const {
    data: events = [],
    isLoading,
    refetch,
    isFetching,
  } = useGetAuditLogs(filter);

  const toggleType = (t: AuditLogEventType) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Recent changes to this mcpx instance.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b px-6 py-3">
        {ALL_EVENT_TYPES.map((t) => {
          const active = selectedTypes.includes(t);
          const badge = EVENT_BADGE[t];
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className="focus-visible:outline-none"
              type="button"
            >
              <Badge
                variant={active ? badge.variant : "outline"}
                size="md"
                className={`cursor-pointer ${active && badge.className ? badge.className : ""}`}
              >
                {EVENT_LABEL[t]}
              </Badge>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No audit events match the current filter.
        </div>
      ) : (
        <div className="px-6 py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-56">Time</TableHead>
                <TableHead className="w-40">Event</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((entry, idx) => {
                const key = `${entry.timestamp.toISOString()}-${idx}`;
                const isOpen = expandedKey === key;
                return (
                  <Fragment key={key}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedKey(isOpen ? null : key)}
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDateTimeLong(entry.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={EVENT_BADGE[entry.eventType].variant}
                          size="md"
                          className={EVENT_BADGE[entry.eventType].className}
                        >
                          {EVENT_LABEL[entry.eventType]}
                        </Badge>
                      </TableCell>
                      <TableCell>{summarize(entry)}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/30">
                          <pre className="overflow-x-auto text-xs">
                            {JSON.stringify(entry.payload, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
