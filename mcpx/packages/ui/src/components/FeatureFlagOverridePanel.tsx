import { useState } from "react";
import { Settings2 } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FEATURE_FLAG_KEYS, useFeatureFlags } from "@/contexts/feature-flags";
import { cn } from "@/lib/utils";

export function FeatureFlagOverridePanel(): React.JSX.Element | null {
  const {
    featureFlags,
    setFeatureFlagOverride,
    resetFeatureFlagOverrides,
    isFeatureFlagOverridden,
  } = useFeatureFlags();
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) return null;

  const hasOverrides = FEATURE_FLAG_KEYS.some((key) =>
    isFeatureFlagOverridden(key),
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col-reverse items-end gap-2">
        <CollapsibleTrigger
          aria-label="Dev flags"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "pointer-events-auto rounded-full shadow-md",
          )}
        >
          <Settings2 data-icon="inline-start" aria-hidden="true" />
          Dev flags
        </CollapsibleTrigger>

        <CollapsibleContent className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border bg-muted px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Dev flags</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Local overrides · development only
            </p>
          </div>

          <div className="max-h-[min(70vh,28rem)] overflow-y-auto px-4">
            {FEATURE_FLAG_KEYS.map((key) => {
              const overridden = isFeatureFlagOverridden(key);

              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{key}</p>
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        overridden ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {overridden ? "Override" : "Inherited"}
                    </p>
                  </div>
                  <Switch
                    size="sm"
                    checked={featureFlags[key]}
                    onCheckedChange={(checked) =>
                      setFeatureFlagOverride(key, checked)
                    }
                    aria-label={key}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted px-4 py-3">
            <p className="text-[11px] text-muted-foreground">
              Overrides persist in localStorage
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hasOverrides}
              onClick={resetFeatureFlagOverrides}
            >
              Reset all
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
