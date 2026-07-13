import { matchRoutes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createAppRoutes } from "@/pages/app-routes";
import { routes } from "@/routes";

vi.mock("@/config/runtime-config", () => ({
  isSkillsPageEnabled: () => true,
}));

vi.mock("@/pages/AuditLog", () => ({ default: () => null }));
vi.mock("@/pages/Dashboard", () => ({ default: () => null }));
vi.mock("@/pages/Tools", () => ({ default: () => null }));
vi.mock("@/pages/Catalog", () => ({ default: () => null }));
vi.mock("@/pages/SavedSetups", () => ({ default: () => null }));
vi.mock("@/pages/Skills", () => ({ default: () => null }));
vi.mock("@/pages/SkillCreateStart", () => ({ default: () => null }));
vi.mock("@/pages/SkillCapabilitiesEditor", () => ({ default: () => null }));
vi.mock("@/pages/SkillDetail", () => ({ default: () => null }));
vi.mock("@/pages/SkillEditor", () => ({ default: () => null }));
vi.mock("@/pages/McpServerAdd", () => ({ default: () => null }));
vi.mock("@/pages/McpServers", () => ({ default: () => null }));
vi.mock("@/pages/NotFound", () => ({ default: () => null }));
vi.mock("@/pages/Capabilities", () => ({ default: () => null }));
vi.mock("@/pages/Login", () => ({
  LoginRoute: () => null,
  LogoutRoute: () => null,
}));
vi.mock("@/pages/app-route-components", () => ({
  AuthenticatedLayoutRoute: () => null,
  RootRoute: () => null,
}));

describe("createAppRoutes", () => {
  it("registers the Add Server page route", () => {
    const matches = matchRoutes(createAppRoutes(), routes.mcpServerAdd);

    expect(
      matches?.some((match) => match.route.path === routes.mcpServerAdd),
    ).toBe(true);
  });
});
