import React from "react";

interface InstructionSectionProps {
  title: string;
  children: React.ReactNode;
}

export const InstructionSection: React.FC<InstructionSectionProps> = ({
  title,
  children,
}) => {
  return (
    <div className="bg-mcpx-surface-subtle border border-mcpx-border-subtle rounded-lg p-4 text-sm text-mcpx-text-secondary">
      <h4 className="font-medium text-mcpx-text mb-2">{title}</h4>
      {children}
    </div>
  );
};
