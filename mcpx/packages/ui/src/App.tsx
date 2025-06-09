import "./App.css";
import Pages from "@/pages/index.jsx";
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from "react";
import { socketStore } from "@/store";

function App() {
  const connect = socketStore((s) => s.connect);

  useEffect(() => {
    connect();
  }, []);
  return (
    <>
      <Pages />
      <Toaster />
    </>
  );
}

export default App;
