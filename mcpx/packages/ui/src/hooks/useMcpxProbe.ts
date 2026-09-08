import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { getMcpxServerURL } from "@/config/api-config";
import { getRuntimeConfigSync } from "@/config/runtime-config";

const POLL_INTERVAL_MS = 1000;
const RECOVERY_COOLDOWN_MS = 5000;

type AuthPayload = {
  status?: string;
  error?: string | { data?: { instanceStatus?: unknown } };
  message?: string;
  data?: { instanceStatus?: unknown };
};

type ProbeDecision = {
  state: McpxProbeState;
  shouldRequestRecovery?: true;
};

type FetchProbeStateOptions = {
  url: string;
  signal: AbortSignal;
  requestRecovery: () => void;
};

export type McpxProbeState =
  | { type: "checking" }
  | { type: "ready" }
  | { type: "approval-pending" }
  | { type: "instance"; status: "initializing" | "error" }
  | { type: "gateway-unavailable" }
  | { type: "unauthorized"; message: string };

export function useMcpxProbe({ enabled = true }: { enabled?: boolean } = {}) {
  const recoveryInFlightRef = useRef(false);
  const lastRecoveryAttemptAtRef = useRef<number | null>(null);
  const url = `${getMcpxServerURL("http")}/auth/mcpx`;
  const queryKey = ["mcpx-probe", url] as const;
  const runtimeConfig = getRuntimeConfigSync();
  const enterpriseEnabled =
    runtimeConfig.VITE_ENABLE_ENTERPRISE === "true" ||
    import.meta.env.VITE_ENABLE_ENTERPRISE === "true";
  const queryEnabled = enterpriseEnabled && enabled;

  const requestRecovery = useCallback(() => {
    const now = Date.now();
    const lastAttemptAt = lastRecoveryAttemptAtRef.current;
    if (
      recoveryInFlightRef.current ||
      (lastAttemptAt !== null && now - lastAttemptAt < RECOVERY_COOLDOWN_MS)
    ) {
      return;
    }

    recoveryInFlightRef.current = true;
    lastRecoveryAttemptAtRef.current = now;
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    })
      .catch(() => undefined)
      .finally(() => {
        recoveryInFlightRef.current = false;
      });
  }, [url]);

  useEffect(() => {
    if (!queryEnabled) lastRecoveryAttemptAtRef.current = null;
  }, [queryEnabled]);

  const { data, refetch } = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      fetchProbeState({
        url,
        signal,
        requestRecovery,
      }),
    enabled: queryEnabled,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    refetchInterval: (query) =>
      shouldPoll(query.state.data) ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
  });

  const refresh = useCallback(() => {
    if (queryEnabled) void refetch();
  }, [queryEnabled, refetch]);

  const state = resolveProbeState({ enterpriseEnabled, enabled, data });

  return { state, refresh };
}

async function fetchProbeState({
  url,
  signal,
  requestRecovery,
}: FetchProbeStateOptions): Promise<McpxProbeState> {
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      signal,
    });
    const payload = (await response
      .json()
      .catch(() => null)) as AuthPayload | null;
    if (signal.aborted) throw signal.reason;
    const decision = mapProbeResponse(response, payload);
    if (decision.shouldRequestRecovery) requestRecovery();
    return decision.state;
  } catch (error) {
    if (signal.aborted) throw error;
    return { type: "gateway-unavailable" };
  }
}

function resolveProbeState({
  enterpriseEnabled,
  enabled,
  data,
}: {
  enterpriseEnabled: boolean;
  enabled: boolean;
  data: McpxProbeState | undefined;
}): McpxProbeState {
  if (!enterpriseEnabled) return { type: "ready" };
  if (!enabled) return { type: "checking" };
  return data ?? { type: "checking" };
}

function mapProbeResponse(
  response: Pick<Response, "ok" | "status">,
  payload: AuthPayload | null,
): ProbeDecision {
  if (response.status === 503) {
    const instanceStatusHint =
      payload?.data?.instanceStatus ??
      (typeof payload?.error === "object"
        ? payload.error.data?.instanceStatus
        : undefined);

    switch (instanceStatusHint) {
      case "approval-pending":
        return { state: { type: "approval-pending" } };
      case "failing":
        return { state: { type: "instance", status: "error" } };
      case "initializing":
      case undefined:
        return { state: { type: "instance", status: "initializing" } };
      default:
        return { state: { type: "gateway-unavailable" } };
    }
  }

  if (response.ok && payload?.status === "authenticated") {
    return { state: { type: "ready" } };
  }

  if (response.ok && payload?.status === "unauthenticated") {
    return {
      state: { type: "gateway-unavailable" },
      shouldRequestRecovery: true,
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      state: {
        type: "unauthorized",
        message:
          (typeof payload?.error === "string"
            ? payload.error
            : payload?.message) ||
          `Authentication check failed (${response.status})`,
      },
    };
  }

  return { state: { type: "gateway-unavailable" } };
}

function shouldPoll(state: McpxProbeState | undefined): boolean {
  return (
    state?.type === "instance" ||
    state?.type === "approval-pending" ||
    state?.type === "gateway-unavailable"
  );
}
