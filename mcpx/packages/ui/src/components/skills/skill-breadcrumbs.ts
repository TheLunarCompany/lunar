import type { BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { routes } from "@/routes";
import { generatePath } from "react-router-dom";

export function getSkillBreadcrumbs({
  id,
  skillName,
  current,
}: {
  id?: string;
  skillName?: string;
  current?: string;
}): BreadcrumbItem[] {
  return [
    { label: "Skills", to: routes.skills },
    ...(id
      ? [
          {
            label: skillName ?? "Skill",
            to: generatePath(routes.skillDetail, { id }),
          },
        ]
      : []),
    ...(current ? [{ label: current }] : []),
  ];
}
