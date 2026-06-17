import { useRef } from "react";

import {
  getHostedMcpEditContextFromLocation,
  type HostedMcpEditContext,
} from "./hosted-mcp-edit-context";

export function useInitialHostedMcpEditContext(): HostedMcpEditContext | null {
  const initialHostedMcpEditContextRef = useRef<
    HostedMcpEditContext | null | undefined
  >(undefined);

  if (initialHostedMcpEditContextRef.current === undefined) {
    initialHostedMcpEditContextRef.current =
      getHostedMcpEditContextFromLocation();
  }

  return initialHostedMcpEditContextRef.current;
}
