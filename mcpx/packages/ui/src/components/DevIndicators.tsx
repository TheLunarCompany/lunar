import { isMswMockEnabled } from "@/mocks/config";
import { isToolsPageMockEnabled } from "@/mocks/tools-page/config";
import { type ReactNode } from "react";

function DevIndicator({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "info" | "warning";
}) {
  const variantClassName =
    variant === "warning"
      ? "border-[var(--colors-warning-200)] bg-[var(--colors-warning-100)] text-[var(--colors-warning-800)]"
      : "border-[var(--colors-info-200)] bg-[var(--colors-info-100)] text-[var(--colors-info-800)]";

  return (
    <div
      className={`rounded border px-2 py-1 text-xs font-medium shadow-sm ${variantClassName}`}
    >
      {children}
    </div>
  );
}

export function DevIndicators() {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex flex-col items-end gap-1">
      {isMswMockEnabled() ? (
        <DevIndicator variant="warning">MSW</DevIndicator>
      ) : null}
      {isToolsPageMockEnabled ? (
        <DevIndicator variant="info">Mock Tools</DevIndicator>
      ) : null}
    </div>
  );
}
