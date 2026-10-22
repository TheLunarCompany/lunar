import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { Logger } from "winston";
import { env } from "../env.js";

export const METER_NAME = "mcpx-server";
const METRICS_PATH = "/metrics";

export function startMetricsEndpoint(logger: Logger): MeterProvider {
  if (!env.ENABLE_METRICS) {
    logger.info("Metrics endpoint is disabled");
    return new MeterProvider();
  }
  logger.info("Starting Prometheus metrics endpoint", {
    port: env.SERVE_METRICS_PORT,
  });
  const port = env.SERVE_METRICS_PORT;
  const exporter = new PrometheusExporter({ port, endpoint: METRICS_PATH });

  return new MeterProvider({ readers: [exporter] });
}
