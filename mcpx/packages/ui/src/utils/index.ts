import { ServerTool } from "@/store/tools";
import { McpJsonFormat } from "@/types";
import { SystemState } from "@mcpx/shared-model";
import { format } from "date-fns";
import sortBy from "lodash/sortBy";

export function createPageUrl(pageName: string) {
  return "/" + pageName.toLowerCase().replace(/ /g, "-");
}

export const formatRelativeTime = (timestamp: number): string => {
  if (!timestamp) return "N/A";

  const rtf = new Intl.RelativeTimeFormat("en", {
    localeMatcher: "best fit",
    numeric: "auto",
    style: "long",
  });

  try {
    const now = new Date();
    const lastCall = new Date(timestamp);
    const diffInMinutes = Math.floor(
      (now.getTime() - lastCall.getTime()) / (1000 * 60),
    );
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return rtf.format(-diffInMinutes, "minute");
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return rtf.format(-diffInHours, "hour");
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return rtf.format(-diffInDays, "day");
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return rtf.format(-diffInMonths, "month");
    const diffInYears = Math.floor(diffInMonths / 12);
    return rtf.format(-diffInYears, "year");
  } catch (e) {
    return "Invalid date";
  }
};

export const formatDateTime = (
  dateTime: Date | string | number | null | undefined,
): string => {
  if (!dateTime) return "N/A";
  try {
    return format(new Date(dateTime), "MMM d, HH:mm");
  } catch (e) {
    return "Invalid date";
  }
};

export const isActive = (
  lastCalledAt: Date | string | number | null | undefined,
) => {
  if (!lastCalledAt) return false;
  const lastCall = new Date(lastCalledAt).getTime();
  const now = new Date().getTime();
  const diffInMinutes = (now - lastCall) / (1000 * 60);
  return diffInMinutes < 1;
};

export const toMcpJsonFormat = (targetServers: SystemState["targetServers"]) =>
  sortBy(targetServers, (s) => s.name).reduce(
    (acc, { args, command, env, icon, name }) => {
      acc[name] = {
        args: (args || "").split(" ").filter(Boolean),
        command,
        env: JSON.parse(env || "{}"),
        icon,
      };
      return acc;
    },
    {} as McpJsonFormat,
  );

export const toToolId = (serviceName: string, toolName: string) =>
  `${serviceName}__${toolName}`;

export const inputSchemaToParamsList = (
  inputSchema: ServerTool["inputSchema"],
) =>
  Object.entries(inputSchema?.properties || {})
    .map(([paramName, param]) =>
      param && typeof param === "object"
        ? {
            name: paramName,
            type: ("type" in param && param.type) || "string",
            description: ("description" in param && param.description) || "",
          }
        : null,
    )
    .filter(Boolean) as { name: string; type: string; description: string }[];

export const injectParamsListOverrides = (
  paramsList: { name: string; type: string; description: string }[],
  paramsValues: Record<string, string | number | boolean | undefined>,
) =>
  paramsList.map(({ name, type, description }) => ({
    name,
    type,
    description,
    value:
      type === "number"
        ? Number.isNaN(Number(paramsValues[name]))
          ? undefined
          : Number(paramsValues[name])
        : type === "boolean"
          ? paramsValues[name] === true || paramsValues[name] === "true"
            ? true
            : paramsValues[name] === false || paramsValues[name] === "false"
              ? false
              : undefined
          : type === "string" || type === "array" || type === "object"
            ? (paramsValues[name] ?? undefined)
            : undefined,
  }));
