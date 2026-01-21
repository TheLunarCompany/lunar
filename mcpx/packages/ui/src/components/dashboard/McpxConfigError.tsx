import { XCircle } from "lucide-react";

// mcpx/packages/ui/src/components/dashboard/McpxConfigError.tsx
export const McpxConfigError = ({ message }: { message: string | null }) => (
  <div className="fixed inset-0 bg-pink-50 flex items-center justify-center">
    <div className="flex flex-col items-center text-center">
      <XCircle className="w-16 h-16 mb-4" style={{ color: "#ef4444" }} />
      <h1 className="text-2xl font-bold mb-4" style={{ color: "#ef4444" }}>
        Configuration Error
      </h1>
      <p className="text-lg mb-2" style={{ color: "#b91c1c" }}>
        {message || "Failed to load MCPX config: data is missing or invalid."}
      </p>
      <p className="text-lg" style={{ color: "#b91c1c" }}>
        Please check your MCPX server configuration and ensure it is set up
        correctly.
      </p>
    </div>
  </div>
);
