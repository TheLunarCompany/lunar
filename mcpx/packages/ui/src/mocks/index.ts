import { worker } from "./browser";
import { isToolsPageMockEnabled } from "./tools-page/config";

declare global {
  interface Window {
    __MSW_ENABLED__?: boolean;
  }
}

function shouldEnableMocks() {
  return import.meta.env.DEV && import.meta.env.VITE_MSW_ENABLED === "true";
}

export async function enableMocks(): Promise<void> {
  if (shouldEnableMocks()) {
    await worker.start({ onUnhandledRequest: "bypass" });
    window.__MSW_ENABLED__ = true;
  }

  if (isToolsPageMockEnabled) {
    const { seedToolsPageMockState } = await import("./tools-page/seed-state");
    seedToolsPageMockState();
  }
}
