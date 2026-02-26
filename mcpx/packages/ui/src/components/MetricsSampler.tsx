import { useMetricsSampler } from "@/hooks/useMetricsCache";

/**
 * Invisible component that continuously samples system metrics into the
 * Zustand metrics store. Renders nothing — mount it at the app root so
 * sampling runs regardless of which page the user is viewing.
 */
export function MetricsSampler() {
  useMetricsSampler();
  return null;
}
