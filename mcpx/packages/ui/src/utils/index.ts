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
