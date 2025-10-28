import React from "react";
import { Server, Wrench } from "lucide-react";

export type HierarchyKind = "server" | "tool" | "custom" | "customCreate" | "default";

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

const defaultPalette: HierarchyPalette = {
  server: { bg: "bg-gray-100", text: "text-gray-700", icon: "text-gray-600" },
  tool: { bg: "bg-green-100", text: "text-green-700", icon: "text-green-600" },
  custom: { bg: "bg-purple-100", text: "text-purple-700", icon: "text-purple-600" },
  customCreate: { bg: "bg-purple-100", text: "text-purple-700", icon: "text-purple-600" },
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

  console.log(  serverName,
    toolName)


  return (
    <div className={`flex items-center text-sm text-gray-700 ${className}`}>
      {toolName ?   <span className="font-medium opacity-50 text-gray-900">{serverName}</span> :   <span className="font-medium  text-gray-900">{serverName}</span> }
    
      {toolName && (
        <>
          <span className="mx-2 text-gray-400">→</span>
          <span className="font-medium text-gray-900">{toolName}</span>
        </>
      )}
    </div>
  );
};

export default HierarchyBadge;


