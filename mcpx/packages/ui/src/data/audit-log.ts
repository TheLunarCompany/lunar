import { apiClient, AuditLogEntry, AuditLogFilter } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const QUERY_KEY = "audit-logs" as const;

export const useGetAuditLogs = (filter: AuditLogFilter = {}) =>
  useQuery<AuditLogEntry[]>({
    queryKey: [QUERY_KEY, filter],
    queryFn: () => apiClient.getAuditLogs(filter),
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });
