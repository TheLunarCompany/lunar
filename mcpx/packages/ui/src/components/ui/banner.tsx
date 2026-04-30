import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerProps {
  description: React.ReactNode;
  className?: string;
}

export function Banner({ description, className }: BannerProps) {
  return (
    <div
      className={cn(
        "flex min-h-12 w-full shrink-0 items-center justify-center gap-3 rounded-lg bg-[#5147E4] px-4 py-3 text-white shadow-sm",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex w-full items-center justify-center gap-3">
          <Info className="w-5 h-5 shrink-0 text-white" />

          <p className="text-center text-sm text-white">{description}</p>
        </div>
      </div>
    </div>
  );
}
