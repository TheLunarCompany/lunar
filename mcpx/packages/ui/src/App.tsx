import { Toaster } from "@/components/ui/toaster";
import Pages from "@/pages/index.jsx";
import { useSocketStore } from "@/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import "@xyflow/react/dist/style.css";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  const connect = useSocketStore((s) => s.connect);

  useEffect(() => {
    connect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Pages />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
