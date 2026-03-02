import type { socketStore } from "../store/socket";

declare global {
  interface Window {
    __MCPX_TEST_MODE__?: boolean;
    __MCPX_SOCKET_STORE__?: typeof socketStore;
  }
}

export {};
