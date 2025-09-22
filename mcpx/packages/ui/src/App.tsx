import { Toaster } from "@/components/ui/toaster";
import Pages from "@/pages/index.jsx";
import { useSocketStore, socketStore } from "@/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.ttf";
import { useEffect } from "react";
import "./App.css";
import { initMonaco } from "./monaco/init-monaco";

const queryClient = new QueryClient();

function App() {
  const connect = useSocketStore((s) => s.connect);
  const pause = useSocketStore((s) => s.pause);
  const resume = useSocketStore((s) => s.resume);
  const isPaused = useSocketStore((s) => s.isPaused);

  useEffect(() => {
    initMonaco();
    connect();
  }, [connect]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pause();
      }
      else if (!document.hidden && document.visibilityState === 'visible') {
        resume();
      }
    };

    const handlePageShow = (_event: PageTransitionEvent) => {
      if (isPaused) {
        resume();
      }
    };

    const handlePageHide = (_event: PageTransitionEvent) => {
      pause();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [pause, resume, isPaused]);

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
