import React from "react";

interface CustomBadgeProps {
  label: React.ReactNode;
  color?: "blue" | "green" | "purple" | "gray" | "red";
  size?: "xs" | "sm" | "md";
  rounded?: "lg" | "full";
  icon?: React.ReactNode;
  className?: string;
}

const sizeToClasses: Record<NonNullable<CustomBadgeProps["size"]>, string> = {
  xs: "text-[9px]  py-0.5 font-semibold",
  sm: "text-xs  py-1 font-semibold",
  md: "text-md  py-2 font-semibold",
};

const colorToClasses: Record<NonNullable<CustomBadgeProps["color"]>, string> = {
  blue: "bg-blue-100 text-[#4F33CC] border-blue-200",
  green: "bg-green-100 text-green-700 border-green-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  gray: "bg-gray-100 text-gray-700 border-gray-200",
  red: "bg-red-100 text-red-700 border-red-200",
};

const CustomBadge: React.FC<CustomBadgeProps> = ({
  label,
  color = "blue",
  size = "xs",
  rounded = "lg",
  icon,
  className = "",
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1 text-[#4F33CC] ${sizeToClasses[size]} rounded-${rounded} 
      `}
      style={{ width: "fit-content" }}
    >
      {icon}
      {label}
    </div>
  );
};

export default CustomBadge;
