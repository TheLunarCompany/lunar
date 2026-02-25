import { Card, CardContent } from "@/components/ui/card";
import {
  MetricSnapshot,
  useMetricsCache,
} from "@/hooks/useMetricsCache";
import { format } from "date-fns";
import { Activity, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DEFAULT_TIME_RANGE,
  parseTimeRange,
  TIME_RANGES,
  TimeRange,
} from "@/pages/metrics-time-range";

type ChartConfig = {
  title: string;
  dataKey: keyof MetricSnapshot;
  color: string;
  fillColor: string;
};

const CHARTS: ChartConfig[] = [
  {
    title: "Tools Available",
    dataKey: "tools",
    color: "#7c3aed",
    fillColor: "#7c3aed20",
  },
  {
    title: "Connected MCP Servers",
    dataKey: "servers",
    color: "#2563eb",
    fillColor: "#2563eb20",
  },
  {
    title: "Active Agents",
    dataKey: "agents",
    color: "#059669",
    fillColor: "#05966920",
  },
  {
    title: "Total Requests",
    dataKey: "totalRequests",
    color: "#d97706",
    fillColor: "#d9770620",
  },
];

function formatXAxis(timestamp: number): string {
  return format(new Date(timestamp), "HH:mm");
}

function MetricChart({
  data,
  config,
}: {
  data: MetricSnapshot[];
  config: ChartConfig;
}) {
  return (
    <Card className="bg-white border-2 shadow-sm rounded-lg">
      <CardContent className="p-4">
        <div className="text-xs font-medium mb-3">{config.title}</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                stroke="#d1d5db"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                stroke="#d1d5db"
                width={40}
              />
              <Tooltip
                labelFormatter={(ts: number) =>
                  format(new Date(ts), "HH:mm:ss")
                }
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              />
              <Area
                type="monotone"
                dataKey={config.dataKey}
                stroke={config.color}
                fill={config.fillColor}
                strokeWidth={2}
                dot={{ r: 3, fill: config.color }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Metrics() {
  const { snapshots, clearCache } = useMetricsCache();
  const [searchParams, setSearchParams] = useSearchParams();
  const timeRange = parseTimeRange(searchParams.get("range"));

  const setTimeRange = useCallback(
    (range: TimeRange) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (range === DEFAULT_TIME_RANGE) {
            next.delete("range");
          } else {
            next.set("range", String(range));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const filteredSnapshots = useMemo(() => {
    const cutoff = Date.now() - timeRange * 60 * 1000;
    return snapshots.filter((s) => s.timestamp >= cutoff);
  }, [snapshots, timeRange]);

  const isEmpty = filteredSnapshots.length === 0;

  return (
    <div className="p-4 md:p-6 bg-gray-100 text-[var(--color-text-primary)] flex flex-col max-h-screen overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-component-primary" />
          <div
            className="font-semibold"
            style={{ color: "#1E1B4B", fontSize: "20px" }}
          >
            Metrics
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex bg-white border border-[var(--color-border-primary)] rounded-lg overflow-hidden">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === range.value
                    ? "bg-[var(--color-bg-interactive)] text-[var(--color-fg-interactive)]"
                    : "text-[var(--color-text-secondary)] hover:bg-gray-50"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Clear cache button */}
          <button
            onClick={clearCache}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] bg-white border border-[var(--color-border-primary)] rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Charts or empty state */}
      {isEmpty ? (
        <Card className="bg-white border-2 shadow-sm rounded-lg">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <Activity className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Collecting metrics…
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Data will appear within a few minutes. Metrics are sampled every 2
              minutes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CHARTS.map((config) => (
            <MetricChart
              key={config.dataKey}
              data={filteredSnapshots}
              config={config}
            />
          ))}
        </div>
      )}
    </div>
  );
}
