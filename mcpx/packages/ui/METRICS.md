# Metrics Page

A time-series metrics page for MCPX that visualizes system health over time using area charts instead of static dashboard cards.

## Design Decisions

### Sampling Strategy
- **Interval:** 2 minutes. Balances granularity against localStorage budget — 60 minutes of data produces at most 30 snapshots (~3 KB), well within the ~5 MB localStorage limit.
- **Global sampling:** A `<MetricsSampler />` component is mounted at the app root (inside `Layout`), not on the Metrics page. This ensures data collection continues regardless of which page the user is viewing.
- **Immediate first sample:** The sampler takes an initial snapshot as soon as real data arrives from the WebSocket, so users don't have to wait 2 minutes to see the first data point.

### Data Architecture
- **Zustand + `persist` middleware** stores snapshots in localStorage under key `mcpx-metrics-cache`. This gives us reactive UI updates, cross-tab persistence, and automatic JSON serialization with zero boilerplate.
- **Pruning on write:** Old entries (>60 min) are removed every time a new snapshot is added, keeping the store bounded without requiring a separate cleanup timer.
- **Shared transform utility:** The `transformConfigurationData` function was extracted from `Dashboard.tsx` into `utils/transform-system-state.ts` so both the Dashboard and the metrics sampler use the same logic to interpret `systemState`.

### Chart Layout
- **One area chart per metric** (Tools, Servers, Agents, Total Requests) in a responsive 2x2 grid. This keeps each chart readable and avoids scale conflicts (e.g., totalRequests can be orders of magnitude larger than server count).
- **Recharts `AreaChart`** was chosen over `LineChart` for better visual weight — the filled area makes trends easier to read at small chart sizes.

### Time Range Selector (Optional Extension)
- Users can filter the view to the last 15, 30, or 60 minutes. The selection is stored in the URL search param (`?range=15`) so it survives page refreshes and is shareable.
- Validated with Zod to prevent invalid values.

### Clear Cache Button (Optional Extension)
- Resets the Zustand store and localStorage in one action. Useful for development and for users who want a clean slate.

## Snapshot Shape

```ts
{
  timestamp: number;    // Date.now() at sample time
  tools: number;        // Available tools count
  servers: number;      // Connected MCP servers (running + stopped)
  agents: number;       // Active agents (connected + recently active)
  totalRequests: number // systemUsage.callCount
}
```

## How to Run

```bash
cd lunar/mcpx
npm install
npm run build:deps
npm run dev:all
```

Open http://localhost:5173/metrics to see the Metrics page.

The page starts with an empty state message. Once the MCPX server is running with at least one connected MCP server or agent, the first data point appears immediately and subsequent samples are taken every 2 minutes.

## How to Test

```bash
cd lunar/mcpx/packages/ui
npx vitest run
```

Tests cover:
- **Store operations** — addSnapshot, pruning, clearCache, localStorage persistence, quota error handling
- **deriveMetrics** — server filtering by status, agent activity detection, tools count parsing, edge cases
- **Store integration** — multi-sample accumulation, pruning boundary conditions
- **Time range parsing** — valid/invalid values, fallback behavior

## Files Added/Modified

| File | Change |
|------|--------|
| `src/pages/Metrics.tsx` | New — metrics page with 4 area charts |
| `src/hooks/useMetricsCache.ts` | New — sampling hook and metric derivation |
| `src/hooks/useMetricsCache.test.ts` | New — unit tests |
| `src/store/metrics.ts` | New — Zustand store with localStorage persistence |
| `src/components/MetricsSampler.tsx` | New — invisible global sampler component |
| `src/utils/transform-system-state.ts` | New — extracted from Dashboard.tsx |
| `src/pages/metrics-time-range.ts` | New — time range type and parser |
| `src/pages/metrics-time-range.test.ts` | New — time range tests |
| `src/pages/index.tsx` | Modified — added /metrics route and MetricsSampler |
| `src/components/layout/Layout.tsx` | Modified — added Metrics to sidebar nav |
| `src/pages/Dashboard.tsx` | Modified — uses shared transform utility |
| `src/store/index.ts` | Modified — exports metrics store |

## Assumptions & Limitations

- **Client-side only:** No server-side metrics endpoint exists, so all data is derived from the WebSocket `systemState`. If the browser tab is closed, no samples are collected during that time — gaps will appear in the charts.
- **Single-tab sampling:** Multiple open tabs will each sample independently into the same localStorage key. Zustand's persist middleware handles this gracefully (last write wins), but it can produce slightly irregular intervals.
