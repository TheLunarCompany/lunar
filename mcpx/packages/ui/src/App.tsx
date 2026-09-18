import { Toaster } from "@/components/ui/toaster";
import Pages from "@/pages/index.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.ttf";
import { useEffect } from "react";
import "./App.css";
import { initMonaco } from "./monaco/init-monaco";
import { AuthProvider } from "@/contexts/AuthContext";
import { DevIndicators } from "@/components/DevIndicators";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { FeatureFlagOverridePanel } from "@/components/FeatureFlagOverridePanel";

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    initMonaco();
  }, []);

  return (
    <FeatureFlagsProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ReactFlowProvider>
              <Pages />
              <Toaster />
              <DevIndicators />
              <FeatureFlagOverridePanel />
            </ReactFlowProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </FeatureFlagsProvider>
  );
}

export default App;
