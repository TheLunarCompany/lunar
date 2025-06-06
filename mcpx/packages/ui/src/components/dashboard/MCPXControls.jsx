import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Shield, Settings, Lock, Unlock, AlertTriangle } from "lucide-react";

export default function MCPXControls({ controls, onControlChange }) {
  const [localControls, setLocalControls] = useState(
    controls || {
      rateLimiting: true,
      accessControl: true,
      logging: true,
      authentication: false,
    },
  );

  const handleToggle = (control) => {
    const newControls = {
      ...localControls,
      [control]: !localControls[control],
    };
    setLocalControls(newControls);
    onControlChange(newControls);
  };

  const controlItems = [
    {
      id: "rateLimiting",
      label: "Rate Limiting",
      description: "Limit requests per minute to MCP servers",
      icon: Shield,
      severity: "medium",
    },
    {
      id: "accessControl",
      label: "Access Control",
      description: "Enforce authentication for MCP server access",
      icon: Lock,
      severity: "high",
    },
    {
      id: "logging",
      label: "Request Logging",
      description: "Log all MCP server interactions",
      icon: Settings,
      severity: "low",
    },
    {
      id: "authentication",
      label: "Token Authentication",
      description: "Require API tokens for agent connections",
      icon: AlertTriangle,
      severity: "high",
    },
  ];

  const getSeverityBadgeStyle = (severity, enabled) => {
    if (!enabled)
      return "bg-[var(--color-bg-neutral)] text-[var(--color-text-secondary)] border-[var(--color-border-primary)]";

    const styles = {
      low: "bg-[var(--color-bg-info)] text-[var(--color-fg-info)] border-[var(--color-border-info)]",
      medium:
        "bg-[var(--color-bg-warning)] text-[var(--color-fg-warning)] border-[var(--color-border-warning)]",
      high: "bg-[var(--color-bg-danger)] text-[var(--color-fg-danger)] border-[var(--color-border-danger)]",
    };
    return styles[severity];
  };

  return (
    <Card className="shadow-sm border-[var(--color-border-primary)] bg-[var(--color-bg-container)]">
      <CardHeader className="border-b border-[var(--color-border-primary)] pb-4">
        <CardTitle className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
          <Shield className="w-6 h-6 text-[var(--color-fg-interactive)]" />
          MCPX Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {controlItems.map((control) => {
            const isEnabled = localControls[control.id];
            const IconComponent = control.icon;

            return (
              <div
                key={control.id}
                className="flex items-center justify-between p-4 bg-[var(--color-bg-container-overlay)] rounded-lg border border-[var(--color-border-primary)]"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      isEnabled
                        ? "bg-[var(--color-bg-interactive)]"
                        : "bg-[var(--color-bg-neutral)]"
                    }`}
                  >
                    <IconComponent
                      className={`w-5 h-5 ${
                        isEnabled
                          ? "text-[var(--color-fg-interactive)]"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h5 className="font-medium text-[var(--color-text-primary)]">
                        {control.label}
                      </h5>
                      <Badge
                        variant="outline"
                        className={getSeverityBadgeStyle(
                          control.severity,
                          isEnabled,
                        )}
                      >
                        {control.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {control.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => handleToggle(control.id)}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-[var(--color-text-primary)]">
                Security Level
              </h5>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {Object.values(localControls).filter(Boolean).length} of{" "}
                {controlItems.length} controls enabled
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                Object.values(localControls).filter(Boolean).length >= 3
                  ? "bg-[var(--color-bg-success)] text-[var(--color-fg-success)] border-[var(--color-border-success)]"
                  : "bg-[var(--color-bg-warning)] text-[var(--color-fg-warning)] border-[var(--color-border-warning)]"
              }
            >
              {Object.values(localControls).filter(Boolean).length >= 3
                ? "High"
                : "Medium"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
