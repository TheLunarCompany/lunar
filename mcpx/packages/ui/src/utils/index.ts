import { ServerTool } from "@/store/tools";
import { ToolExtensionParamsRecord } from "@mcpx/shared-model";
import { format } from "date-fns";

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
  } catch {
    return "Invalid date";
  }
};

export const formatDateTime = (
  dateTime: Date | string | number | null | undefined,
): string => {
  if (!dateTime) return "N/A";
  try {
    return format(new Date(dateTime), "MMM d, HH:mm");
  } catch {
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
  paramsValues: ToolExtensionParamsRecord,
) =>
  paramsList.map(({ name, type, description }) => ({
    name,
    type,
    description,
    value:
      type === "number"
        ? Number.isNaN(Number(paramsValues[name]?.value))
          ? undefined
          : Number(paramsValues[name]?.value)
        : type === "boolean"
          ? paramsValues[name]?.value === true ||
            paramsValues[name]?.value === "true"
            ? true
            : paramsValues[name]?.value === false ||
                paramsValues[name]?.value === "false"
              ? false
              : undefined
          : type === "string" || type === "array" || type === "object"
            ? (paramsValues[name]?.value ?? undefined)
            : undefined,
  }));

// Compare two Sets for equality
export function areSetsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
  if (set1.size !== set2.size) return false;

  for (const item of set1) {
    if (!set2.has(item)) return false;
  }

  return true;
}

// Debounce utility function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
