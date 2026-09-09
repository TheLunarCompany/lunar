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
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
      <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
      {children}
    </div>
  );
};
