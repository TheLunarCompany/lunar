import * as React from "react";

import { cn } from "@/lib/utils";

type NodeCardIconProps = React.ComponentProps<"div"> & {
  src?: string;
  alt?: string;
};

function NodeCardIcon({
  className,
  src,
  alt = "",
  children,
  ...props
}: NodeCardIconProps) {
  return (
    <div
      data-slot="node-card-icon"
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center rounded-[var(--border-radius-md)] border border-black/8 bg-white",
        className,
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt} className="size-[30px] object-contain" />
      ) : (
        children
      )}
    </div>
  );
}

export { NodeCardIcon };
export type { NodeCardIconProps };
