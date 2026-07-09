import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

type BreadcrumbItem = {
  label: React.ReactNode;
  to?: string;
};

type BreadcrumbsProps = React.ComponentProps<"nav"> & {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items, className, ...props }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex min-w-0 items-center text-xs font-medium text-[var(--text-colours-color-text-tertiary)]",
        className,
      )}
      {...props}
    >
      <ol className="flex min-w-0 items-center gap-1">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li key={index} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight aria-hidden="true" className="size-3" />
              ) : null}
              {item.to && !isCurrent ? (
                <Link
                  to={item.to}
                  className="shrink-0 rounded-sm transition hover:text-[var(--text-colours-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "min-w-0 truncate",
                    isCurrent &&
                      "text-[var(--text-colours-color-text-secondary)]",
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
