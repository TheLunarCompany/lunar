import { Button } from "@/components/ui/button";
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type BreadcrumbBackButtonProps = {
  items: BreadcrumbItem[];
};

export function BreadcrumbBackButton({ items }: BreadcrumbBackButtonProps) {
  const previousItem = [...items]
    .slice(0, -1)
    .reverse()
    .find((item) => item.to);

  if (!previousItem?.to) {
    return null;
  }

  return (
    <Button
      asChild
      variant="outline"
      size="icon-lg"
      aria-label={`Back to ${getBreadcrumbLabel(previousItem)}`}
      className="size-11 rounded-md"
    >
      <Link to={previousItem.to}>
        <ArrowLeft />
      </Link>
    </Button>
  );
}

function getBreadcrumbLabel(item: BreadcrumbItem) {
  return typeof item.label === "string" ? item.label : "previous page";
}
