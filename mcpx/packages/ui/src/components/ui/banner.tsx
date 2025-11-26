import { X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerProps {
  title?: string;
  description: string;
  variant?: "info";
  onClose?: () => void;
  className?: string;
}

export function Banner({
  title,
  description,
  variant = "info",
  onClose,
  className,
}: BannerProps) {
  return (
    <div
      className={cn(
        "flex flex-row justify-center items-center gap-[10px] flex-shrink-0 w-full  h-12 p-4 bg-[#5147E4] text-white mb-4",
        className,
      )}
    >
      <div className="flex flex-row w-full items-center justify-between w-full">
        <div className="flex flex-row w-full items-center justify-center gap-3">
          <Info className="w-5 h-5 flex-shrink-0 text-white" />
       
     
            <p className="text-sm text-white">  {description}</p>
        
        </div>
        {/* {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors duration-200 flex-shrink-0"
            aria-label="Close banner"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        )} */}
      </div>
    </div>
  );
}

