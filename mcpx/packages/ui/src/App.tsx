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
import { ConnectionManager } from "@/components/ConnectionManager";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

function MSWIndicator() {
  if (!import.meta.env.DEV || !window.__MSW_ENABLED__) {
    return null;
  }

  return (
    <div className="fixed top-3 right-3 z-50 rounded bg-yellow-400 px-2 py-1 text-xs font-medium text-black shadow-sm">
      MSW
    </div>
  );
}

function App() {
  useEffect(() => {
    initMonaco();
  }, []);

  return (
    <AuthProvider>
      <ConnectionManager />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ReactFlowProvider>
            <Pages />
            <Toaster />
            <MSWIndicator />
          </ReactFlowProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
