import { worker } from "./browser";

declare global {
  interface Window {
    __MSW_ENABLED__?: boolean;
  }
}

function shouldEnableMocks() {
  return import.meta.env.DEV && import.meta.env.VITE_MSW_ENABLED === "true";
}

export async function enableMocks(): Promise<void> {
  if (!shouldEnableMocks()) {
    return;
  }

  await worker.start({ onUnhandledRequest: "bypass" });
  window.__MSW_ENABLED__ = true;
}
