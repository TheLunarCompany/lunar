import type { CatalogToolItem } from "@/hooks/useToolCatalog";

export type AnnotationFilterValue = "read-only" | "write" | "destructive";

export function matchesAnnotationFilter(
  tool: CatalogToolItem,
  filters: AnnotationFilterValue[],
): boolean {
  if (filters.length === 0) {
    return true;
  }

  const annotations = tool.annotations;
  if (!annotations) {
    return false;
  }

  return filters.some((filter) => {
    switch (filter) {
      case "read-only":
        return annotations.readOnlyHint === true;
      case "destructive":
        return annotations.destructiveHint === true;
      case "write":
        return !annotations.readOnlyHint && !annotations.destructiveHint;
    }
  });
}
