import React, { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export type HierarchyKind =
  | "server"
  | "tool"
  | "custom"
  | "customCreate"
  | "default";

export interface HierarchyItem {
  label: string;
  kind?: HierarchyKind;
}

export interface HierarchyPaletteEntry {
  bg: string; // Tailwind bg-*
  text: string; // Tailwind text-*
  icon?: string; // Tailwind text-* to color the icon
}

export type HierarchyPalette = Record<HierarchyKind, HierarchyPaletteEntry>;

interface TruncatableTextProps {
  children: string;
  className: string;
}

const TruncatableText: React.FC<TruncatableTextProps> = ({
  children,
  className,
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      if (spanRef.current) {
        const { scrollWidth, clientWidth } = spanRef.current;
        setIsTruncated(scrollWidth > clientWidth);
      }
    };

    // Check immediately and on window resize
    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [children]);

  const spanElement = (
    <span ref={spanRef} className={className}>
      {children}
    </span>
  );

  if (isTruncated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{spanElement}</TooltipTrigger>
        <TooltipContent>
          <p>{children}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return spanElement;
};

const defaultPalette: HierarchyPalette = {
  server: { bg: "bg-gray-100", text: "text-gray-700", icon: "text-gray-600" },
  tool: { bg: "bg-green-100", text: "text-green-700", icon: "text-green-600" },
  custom: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    icon: "text-purple-600",
  },
  customCreate: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    icon: "text-purple-600",
  },
  default: { bg: "bg-gray-100", text: "text-gray-700", icon: "text-gray-600" },
};

export interface HierarchyBadgeProps {
  serverName: string;
  toolName?: string;
  className?: string;
}

export const HierarchyBadge: React.FC<HierarchyBadgeProps> = ({
  serverName,
  toolName,
  className = "",
}) => {
  return (
    <div className={`flex items-center text-sm text-gray-700 ${className}`}>
      <TruncatableText className="font-medium opacity-50 text-gray-900 truncate max-w-[250px] inline-block">
        {serverName}
      </TruncatableText>

      {toolName && (
        <>
          <span className="mx-2 text-gray-400">→</span>
          <TruncatableText className="font-medium text-gray-900 truncate max-w-[250px] inline-block">
            {toolName}
          </TruncatableText>
        </>
      )}
    </div>
  );
};

export default HierarchyBadge;
