import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { EditServerModal } from "./EditServerModal";

vi.mock("@/store", () => ({
  useModalsStore: (
    selector: (state: { editServerModalData: unknown }) => unknown,
  ) =>
    selector({
      editServerModalData: {
        _type: "stdio",
        args: ["-y", "@upstash/context7-mcp"],
        command: "npx",
        env: {},
        icon: "",
        name: "context7",
      },
    }),
}));

vi.mock("@/data/catalog-servers", () => ({
  useGetMCPServers: () => ({ data: [] }),
}));

vi.mock("@/data/permissions", () => ({
  usePermissions: () => ({ canAddCustomServerAndEdit: true }),
}));

vi.mock("@/data/mcp-server", () => ({
  useEditMcpServer: () => ({
    error: null,
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useDomainIcon", () => ({
  useDomainIcon: () => null,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DialogDescription: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DialogFooter: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DialogHeader: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DialogTitle: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("./McpColorInput", () => ({
  McpColorInput: () => <div>icon-input</div>,
}));

vi.mock("./McpJsonForm", () => ({
  McpJsonForm: () => <div data-testid="mcp-json-form">json-form</div>,
}));

describe("EditServerModal", () => {
  it("keeps the dialog shell shrinkable on narrow viewports", () => {
    const html = renderToStaticMarkup(
      <EditServerModal isOpen onClose={vi.fn()} />,
    );

    expect(html).toContain("w-[calc(100%-2rem)]");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("min-h-0");
    expect(html).toContain("[scrollbar-gutter:stable]");
  });
});
