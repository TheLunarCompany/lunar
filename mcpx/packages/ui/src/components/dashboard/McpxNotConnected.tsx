import { XCircle } from "lucide-react";
import { isEnterpriseEnabled } from "@/config/runtime-config";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";

export const McpxNotConnected = () => {
  if (isEnterpriseEnabled()) {
    return (
      <ProvisioningScreen message="Your MCPX workspace is provisioning. We’ll connect automatically once it’s ready." />
    );
  }

  return (
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
};
