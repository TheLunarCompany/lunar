import { Input } from "@/components/ui/input";

export const FixedInput = ({ value }: { value: string }) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Input
        value={value}
        disabled
        readOnly
        className="h-10 w-full min-w-0 rounded-md border-input bg-background px-3 py-2 text-sm flex-1 bg-muted/40 text-muted-foreground cursor-not-allowed"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        (fixed)
      </span>
    </div>
  );
};
