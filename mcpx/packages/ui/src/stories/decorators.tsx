import React, { useEffect } from "react";
import type { Decorator } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { AuthContext } from "@/contexts/auth-internal";
import type { AuthContextValue } from "@/contexts/auth-types";
import { socketStore } from "@/store/socket";
import { Toaster } from "@/components/ui/toaster";
import { createMockAppConfig, createMockSystemState } from "./mocks/data";

// ── React Router decorator ───────────────────────────────────────────────────

export const withRouter: Decorator = (Story) => (
  <MemoryRouter>
    <Story />
  </MemoryRouter>
);

// ── React Query decorator ────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

export const withQueryClient: Decorator = (Story) => (
  <QueryClientProvider client={queryClient}>
    <Story />
  </QueryClientProvider>
);

// ── Auth decorator ───────────────────────────────────────────────────────────

const defaultAuthValue: AuthContextValue = {
  user: { id: "user-1", email: "user@example.com", name: "Test User" },
  isAuthenticated: true,
  loading: false,
  error: null,
  loginRequired: false,
  login: () => {},
  logout: () => {},
  refresh: async () => {},
};

export function withAuth(overrides: Partial<AuthContextValue> = {}): Decorator {
  const AuthDecorator: Decorator = (Story) => (
    <AuthContext.Provider value={{ ...defaultAuthValue, ...overrides }}>
      <Story />
    </AuthContext.Provider>
  );
  return AuthDecorator;
}

// ── Socket store decorator (sets zustand state directly) ─────────────────────

function SocketStoreInitializer({
  children,
  overrides,
}: {
  children: React.ReactNode;
  overrides: {
    isConnected?: boolean;
    isPending?: boolean;
    connectError?: boolean;
  };
}) {
  useEffect(() => {
    socketStore.setState({
      isConnected: overrides.isConnected ?? true,
      isPending: overrides.isPending ?? false,
      connectError: overrides.connectError ?? false,
      systemState: createMockSystemState(),
      appConfig: createMockAppConfig(),
    });
  }, [overrides]);
  return <>{children}</>;
}

export function withSocketStore(
  overrides: {
    isConnected?: boolean;
    isPending?: boolean;
    connectError?: boolean;
  } = {},
): Decorator {
  const SocketDecorator: Decorator = (Story) => (
    <SocketStoreInitializer overrides={overrides}>
      <Story />
    </SocketStoreInitializer>
  );
  return SocketDecorator;
}

// ── ReactFlow decorator ─────────────────────────────────────────────────────

export const withReactFlow: Decorator = (Story) => (
  <ReactFlowProvider>
    <Story />
  </ReactFlowProvider>
);

// ── Toaster decorator ────────────────────────────────────────────────────────

export const withToaster: Decorator = (Story) => (
  <>
    <Story />
    <Toaster />
  </>
);

// ── Combined "app shell" decorator ──────────────────────────────────────────

function AppShellWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    socketStore.setState({
      isConnected: true,
      isPending: false,
      connectError: false,
      systemState: createMockSystemState(),
      appConfig: createMockAppConfig(),
    });
  }, []);
  return <>{children}</>;
}

export const withAppShell: Decorator = (Story) => (
  <MemoryRouter>
    <AuthContext.Provider value={defaultAuthValue}>
      <QueryClientProvider client={queryClient}>
        <ReactFlowProvider>
          <AppShellWrapper>
            <Story />
            <Toaster />
          </AppShellWrapper>
        </ReactFlowProvider>
      </QueryClientProvider>
    </AuthContext.Provider>
  </MemoryRouter>
);
