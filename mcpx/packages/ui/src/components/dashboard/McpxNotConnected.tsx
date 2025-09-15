import { XCircle } from "lucide-react";

export const McpxNotConnected = () => (
  <div className="fixed inset-0 bg-pink-50 flex items-center justify-center">
    <div className="flex flex-col items-center text-center">
      <XCircle className="w-16 h-16 mb-4" style={{ color: "#ef4444" }} />

      <h1 className="text-2xl font-bold mb-4" style={{ color: "#ef4444" }}>
        Not Connected
      </h1>
      <p className="text-lg mb-2" style={{ color: "#b91c1c" }}>
        Connection to the MCPX server could not be established.
      </p>
      <p className="text-lg" style={{ color: "#b91c1c" }}>
        Please check your configuration and ensure it is set up correctly.
      </p>
    </div>
  </div>
);
