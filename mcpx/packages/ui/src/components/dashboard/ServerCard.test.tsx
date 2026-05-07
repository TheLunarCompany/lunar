import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ServerCard } from "./ServerCard";

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => null,
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("ServerCard", () => {
  it("uses neutral text styling for catalog copy", () => {
    const html = renderToStaticMarkup(
      <ServerCard
        server={{
          id: "catalog-1",
          name: "clickup",
          displayName: "ClickUp",
          description: "Catalog server description",
          doc: "https://docs.example.com/clickup",
          config: {
            clickup: {
              type: "stdio",
              command: "npx",
              args: [],
              env: {
                CLICKUP_API_KEY: { kind: "required", isSecret: true },
              },
            },
          },
        }}
        onAddServer={vi.fn()}
      />,
    );

    expect(html).toMatch(
      /<div class="[^"]*text-foreground[^"]*">Catalog server description<\/div>/,
    );
    expect(html).not.toMatch(
      /<div class="[^"]*text-primary[^"]*">Catalog server description<\/div>/,
    );
    expect(html).toMatch(
      /<div class="[^"]*text-foreground[^"]*">ENVIRONMENT VARIABLES<\/div>/,
    );
    expect(html).not.toMatch(
      /<div class="[^"]*text-primary[^"]*">ENVIRONMENT VARIABLES<\/div>/,
    );
  });

  it("uses the shared server status badge for catalog status", () => {
    const html = renderToStaticMarkup(
      <ServerCard
        server={{
          id: "catalog-1",
          name: "clickup",
          displayName: "ClickUp",
          description: "Catalog server description",
          doc: "https://docs.example.com/clickup",
          config: {
            clickup: {
              type: "stdio",
              command: "npx",
              args: [],
            },
          },
        }}
        status="pending_auth"
        onAddServer={vi.fn()}
      />,
    );

    expect(html).toContain('data-slot="badge"');
    expect(html).toContain("bg-(--colors-info-50)");
    expect(html).toContain("Pending Authentication");
  });
});
