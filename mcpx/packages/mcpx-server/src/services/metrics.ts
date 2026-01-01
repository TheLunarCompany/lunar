import { Histogram } from "@opentelemetry/api";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { METER_NAME } from "../server/prometheus.js";
export class MetricRecorder {
  private toolCallDurationHistogram: Histogram;

  constructor(meterProvider: MeterProvider) {
    const meter = meterProvider.getMeter(METER_NAME);
    this.toolCallDurationHistogram = meter.createHistogram(
      "tool_call_duration_ms",
      {
        description: "Duration of tool calls in ms",
        unit: "ms",
      },
    );
  }

  public recordToolCallDuration(
    durationMs: number,
    labels: Record<string, string>,
  ): void {
    this.toolCallDurationHistogram.record(durationMs, labels);
  }
}
