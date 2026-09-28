import { XCircle } from "lucide-react";

// mcpx/packages/ui/src/components/dashboard/McpxConfigError.tsx
export const McpxConfigError = ({
  message,
  fullScreen = true,
}: {
  message: string | null;
  fullScreen?: boolean;
}) => (
  <div
    className={`${fullScreen ? "fixed inset-0" : "size-full"} bg-mcpx-danger-bg flex items-center justify-center`}
  >
    <div className="flex flex-col items-center text-center">
      <XCircle
        className="w-16 h-16 mb-4"
        style={{ color: "var(--mcpx-danger-action)" }}
      />
      <h1
        className="text-2xl font-bold mb-4"
        style={{ color: "var(--mcpx-danger-action)" }}
      >
        Configuration Error
      </h1>
      <p className="text-lg mb-2" style={{ color: "var(--mcpx-danger-text)" }}>
        {message || "Failed to load MCPX config: data is missing or invalid."}
      </p>
      <p className="text-lg" style={{ color: "var(--mcpx-danger-text)" }}>
        Please check your MCPX server configuration and ensure it is set up
        correctly.
      </p>
    </div>
  </div>
);
