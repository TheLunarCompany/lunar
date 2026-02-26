import z from "zod/v4";

export const TimeRangeSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(15), z.literal(30), z.literal(60)]));

export type TimeRange = z.infer<typeof TimeRangeSchema>;

export const DEFAULT_TIME_RANGE: TimeRange = 60;

export const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "60m", value: 60 },
];

export function parseTimeRange(value: string | null): TimeRange {
  const result = TimeRangeSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_TIME_RANGE;
}
