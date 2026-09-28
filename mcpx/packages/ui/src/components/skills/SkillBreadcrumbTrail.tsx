import { BreadcrumbBackButton } from "@/components/ui/breadcrumb-back-button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { ChevronRight, House } from "lucide-react";
import { Link } from "react-router-dom";

type SkillBreadcrumbTrailProps = {
  items: BreadcrumbItem[];
  showBackButton?: boolean;
};

export function SkillBreadcrumbTrail({
  items,
  showBackButton = true,
}: SkillBreadcrumbTrailProps) {
  const hasBackLink =
    showBackButton && items.slice(0, -1).some((item) => item.to);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {hasBackLink ? <BreadcrumbBackButton items={items} /> : null}
      <Link
        to="/"
        aria-label="Home"
        className="shrink-0 rounded-sm text-[var(--text-colours-color-text-tertiary)] transition hover:text-[var(--text-colours-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <House aria-hidden="true" className="size-4" />
      </Link>
      <ChevronRight aria-hidden="true" className="size-3" />
      <Breadcrumbs items={items} />
    </div>
  );
}
