import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface EmptyStatePlaceholderProps {
  onAction: () => void;
}

export const NoToolGroupsPlaceholder = ({
  onAction,
}: EmptyStatePlaceholderProps) => {
  return (
    <div className="bg-mcpx-surface rounded-lg p-12 shadow-[var(--mcpx-shadow-weak)] border border-mcpx-border-subtle text-center">
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <svg
            className="w-6 h-6 text-mcpx-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 className="text-lg font-bold text-mcpx-text-secondary">
            No tools groups
          </h3>
        </div>
        <p className="text-mcpx-text-secondary text-sm mb-4">
          It seems you haven't created a group yet, groups will help you focus
          your work.
        </p>
        <Button onClick={onAction} className="mb-4">
          <Plus />
          Create New Tool Group
        </Button>
      </div>
    </div>
  );
};

export const NoServersPlaceholder = ({
  onAction,
}: EmptyStatePlaceholderProps) => {
  return (
    <div className="bg-mcpx-surface rounded-lg p-12 shadow-[var(--mcpx-shadow-weak)] border border-mcpx-border-subtle text-center">
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <svg
            className="w-6 h-6 text-mcpx-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
          <h3 className="text-lg font-bold text-mcpx-text-secondary">
            No Servers Connected
          </h3>
        </div>
        <p className="text-mcpx-text-secondary text-sm mb-4">
          It seems you haven't created a group yet, groups will help you focus
          your work.
        </p>
        <Button onClick={onAction} className="mb-4">
          <Plus />
          Connect server
        </Button>
      </div>
    </div>
  );
};

export const NoToolsFoundPlaceholder = ({
  searchQuery,
}: {
  searchQuery: string;
}) => {
  return (
    <div className="bg-mcpx-surface rounded-lg p-12 shadow-[var(--mcpx-shadow-weak)] border border-mcpx-border-subtle text-center">
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 bg-mcpx-surface-tertiary rounded-lg flex items-center justify-center">
          <svg
            className="w-8 h-8 text-mcpx-text-disabled"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <svg
            className="w-6 h-6 text-mcpx-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="text-lg font-bold text-mcpx-text-secondary">
            No tools found
          </h3>
        </div>
        <p className="text-mcpx-text-secondary text-sm">
          The search term "{searchQuery || "custom tools"}" did not match any
          tools.
        </p>
      </div>
    </div>
  );
};
