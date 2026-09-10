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

const CustomBadge: React.FC<CustomBadgeProps> = ({
  label,
  size = "xs",
  rounded = "lg",
  icon,
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
