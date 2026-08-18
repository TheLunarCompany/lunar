import { describe, expect, it } from "vitest";
import { getSkillBreadcrumbs } from "./skill-breadcrumbs";

describe("getSkillBreadcrumbs", () => {
  it("builds skill detail breadcrumbs with the loaded skill name", () => {
    expect(
      getSkillBreadcrumbs({
        id: "0190a000-0000-7000-8000-000000000004",
        skillName: "brand-voice-guidelines",
      }),
    ).toEqual([
      { label: "Skills", to: "/skills" },
      {
        label: "brand-voice-guidelines",
        to: "/skills/0190a000-0000-7000-8000-000000000004",
      },
    ]);
  });

  it("adds the current page crumb for subpages", () => {
    expect(
      getSkillBreadcrumbs({
        id: "0190a000-0000-7000-8000-000000000004",
        skillName: "brand-voice-guidelines",
        current: "Edit",
      }),
    ).toEqual([
      { label: "Skills", to: "/skills" },
      {
        label: "brand-voice-guidelines",
        to: "/skills/0190a000-0000-7000-8000-000000000004",
      },
      { label: "Edit" },
    ]);
  });

  it("uses a stable fallback when the skill has not loaded yet", () => {
    expect(
      getSkillBreadcrumbs({
        id: "0190a000-0000-7000-8000-000000000004",
        current: "MCP capabilities",
      }),
    ).toEqual([
      { label: "Skills", to: "/skills" },
      {
        label: "Skill",
        to: "/skills/0190a000-0000-7000-8000-000000000004",
      },
      { label: "MCP capabilities" },
    ]);
  });

  it("builds create breadcrumbs without a skill detail link", () => {
    expect(getSkillBreadcrumbs({ current: "Add new" })).toEqual([
      { label: "Skills", to: "/skills" },
      { label: "Add new" },
    ]);
  });
});
