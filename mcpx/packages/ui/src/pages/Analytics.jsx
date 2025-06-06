import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Activity, Clock, Users } from "lucide-react";

export default function Analytics() {
  const cardData = [
    {
      title: "Total Requests",
      value: "1,234",
      change: "+12% from last week",
      icon: BarChart3,
      seriesColor: "var(--color-data-series-1)",
    },
    {
      title: "Active Agents",
      value: "3",
      change: "Connected now",
      icon: Users,
      seriesColor: "var(--color-data-series-2)",
    },
    {
      title: "Avg Response Time",
      value: "245ms",
      change: "-5ms from yesterday",
      icon: Clock,
      seriesColor: "var(--color-data-series-3)",
    },
    {
      title: "Success Rate",
      value: "99.2%",
      change: "+0.1% from last hour",
      icon: Activity,
      seriesColor: "var(--color-data-series-4)",
    },
  ];

  return (
    <div className="p-8 space-y-8 max-w-full mx-auto bg-[var(--color-bg-app)] text-[var(--color-text-primary)]">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          Analytics
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Usage analytics and performance insights
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cardData.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="bg-[var(--color-bg-container)] border-[var(--color-border-primary)]"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-[var(--color-text-primary)]">
                  {card.title}
                </CardTitle>
                <Icon
                  className="h-5 w-5 text-[var(--color-text-secondary)]"
                  style={{ color: card.seriesColor }}
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {card.value}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {card.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-[var(--color-bg-container)] border-[var(--color-border-primary)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-text-primary)]">
            Analytics Dashboard Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[var(--color-text-secondary)]">
            Detailed analytics including request patterns, performance metrics,
            and usage insights will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
