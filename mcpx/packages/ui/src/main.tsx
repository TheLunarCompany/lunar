import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";
import { loadRuntimeConfig } from "@/config/runtime-config";

// Load runtime config and initialize app
async function initializeApp() {
  await loadRuntimeConfig();

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}

initializeApp();
