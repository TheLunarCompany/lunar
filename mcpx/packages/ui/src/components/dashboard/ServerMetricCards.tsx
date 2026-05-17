import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ServerMetricCardsProps = {
  calls: number;
  lastCall: string;
};

export function ServerMetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card className="flex-1 gap-2 rounded-lg bg-(--colors-gray-50) p-3 py-3 shadow-none ring-0">
      <CardHeader className="p-0">
        <CardTitle className="font-sans text-xs font-normal leading-[18px] text-(--colors-gray-600)">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="text-lg font-semibold leading-6 text-(--colors-gray-950)">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export function ServerMetricCards({ calls, lastCall }: ServerMetricCardsProps) {
  return (
    <div className="flex gap-2">
      <ServerMetricCard label="Calls" value={calls} />
      <ServerMetricCard label="Last Call" value={lastCall} />
    </div>
  );
}
