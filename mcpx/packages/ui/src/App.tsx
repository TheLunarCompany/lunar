import { Toaster } from "@/components/ui/toaster";
import Pages from "@/pages/index.jsx";
import { useSocketStore } from "@/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect } from "react";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  const connect = useSocketStore((s) => s.connect);

  useEffect(() => {
    connect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>
        <Pages />
        <Toaster />
      </ReactFlowProvider>
    </QueryClientProvider>
  );
}

export default App;
