import { SystemState } from "@mcpx/shared-model";
import { Page } from "@playwright/test";
import { DELAY_1_SEC, DELAY_2_SEC, TIMEOUT_10_SEC } from "../constants/delays";

/**
 * Sets up route interception to mock socket.io WebSocket messages
 * This intercepts the WebSocket connection and injects mock SystemState
 */
export async function setupSocketMock(
  page: Page,
  systemState: SystemState,
): Promise<void> {
  // Intercept WebSocket connections
  page.on("websocket", (ws) => {
    // When WebSocket connects, wait a bit then send mock SystemState
    ws.on("framesent", (event) => {
      // If the client requests system state, respond with mock data
      if (typeof event.payload === "string") {
        try {
          const payload = JSON.parse(event.payload);
          if (
            payload[1]?.event === "getSystemState" ||
            payload[1]?.event === "SystemState"
          ) {
            // Send mock SystemState response
            setTimeout(() => {
              const response = JSON.stringify([
                "42",
                ["SystemState", systemState],
              ]);
              // Type assertion needed because Playwright WebSocket type doesn't expose send
              (ws as any).send(response);
            }, 100);
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });
  });
}

/**
 * Uses page.addInitScript to inject mock state before the app loads
 * This is the most reliable method for Playwright
 */
export async function injectMockStateBeforeLoad(
  page: Page,
  systemState: SystemState,
): Promise<void> {
  await page.addInitScript((state) => {
    // Store mock state in window for the app to access
    (window as any).__MCPX_MOCK_SYSTEM_STATE__ = state;

    // Override socket.io to use mock data
    const originalIO = (window as any).io;
    (window as any).io = function (url: string, options: any) {
      const socket = originalIO
        ? originalIO(url, options)
        : {
            on: () => {},
            emit: () => {},
            connect: () => {},
            disconnect: () => {},
            connected: true,
          };

      // Mock the SystemState event
      setTimeout(() => {
        if (socket.on) {
          // Simulate receiving SystemState
          const mockEmit = socket.emit;
          socket.emit = function (event: string, ...args: any[]) {
            if (event === "getSystemState") {
              // Trigger SystemState event with mock data
              setTimeout(() => {
                if (socket._callbacks && socket._callbacks["SystemState"]) {
                  socket._callbacks["SystemState"].forEach((callback: any) => {
                    callback(state);
                  });
                }
              }, 50);
            }
            return mockEmit
              ? mockEmit.apply(this, [event, ...args])
              : undefined;
          };
        }
      }, 100);

      return socket;
    };
  }, systemState);
}

/**
 * Directly sets systemState in the Zustand store after page loads
 * This requires the store to be exposed via window
 */
export async function setSystemStateDirect(
  page: Page,
  systemState: SystemState,
): Promise<void> {
  // Wait for the store to be available
  await page.waitForFunction(
    () => {
      return !!(window as any).__MCPX_SOCKET_STORE__;
    },
    { timeout: TIMEOUT_10_SEC },
  );

  await page.evaluate((state) => {
    // Access the store via window (exposed in socket.ts)
    const store = (window as any).__MCPX_SOCKET_STORE__;
    if (store) {
      // Set the system state directly
      store.setState({ systemState: state });
      return;
    }

    // Fallback: dispatch custom event
    window.dispatchEvent(
      new CustomEvent("__MCPX_SET_SYSTEM_STATE__", { detail: state }),
    );
  }, systemState);

  // Wait for React to re-render
  await page.waitForTimeout(DELAY_1_SEC);
}

/**
 * Intercepts socket.io connection and injects mock SystemState
 * This is the most reliable method - it blocks the real connection
 */
export async function interceptSocketAndInjectState(
  page: Page,
  systemState: SystemState,
): Promise<void> {
  // Intercept socket.io before the page loads
  await page.addInitScript((state) => {
    // Store mock state
    (window as any).__MCPX_MOCK_SYSTEM_STATE__ = state;

    // Override socket.io client completely
    const originalIO = (window as any).io;
    (window as any).io = function (url: string, options: any) {
      // Create a mock socket that immediately emits SystemState
      const mockSocket = {
        connected: true,
        id: "mock-socket-id",
        on: function (event: string, callback: any) {
          // Store callbacks
          if (!this._callbacks) this._callbacks = {};
          if (!this._callbacks[event]) this._callbacks[event] = [];
          this._callbacks[event].push(callback);

          // If SystemState listener is registered, call it immediately with mock data
          if (event === "SystemState") {
            setTimeout(() => {
              callback(state);
            }, 100);
          }

          // If connect listener is registered, call it immediately
          if (event === "connect") {
            setTimeout(() => {
              callback();
            }, 50);
          }

          return this;
        },
        off: function () {
          return this;
        },
        emit: function (event: string, ...args: any[]) {
          // If getSystemState is requested, trigger SystemState event
          if (event === "getSystemState") {
            setTimeout(() => {
              if (this._callbacks && this._callbacks["SystemState"]) {
                this._callbacks["SystemState"].forEach((cb: any) => cb(state));
              }
            }, 50);
          }
          return this;
        },
        connect: function () {
          // Trigger connect event
          setTimeout(() => {
            if (this._callbacks && this._callbacks["connect"]) {
              this._callbacks["connect"].forEach((cb: any) => cb());
            }
            // Also trigger SystemState after connect
            if (this._callbacks && this._callbacks["SystemState"]) {
              this._callbacks["SystemState"].forEach((cb: any) => cb(state));
            }
          }, 100);
          return this;
        },
        disconnect: function () {
          return this;
        },
        _callbacks: {} as Record<string, any[]>,
      };

      // Auto-connect after a short delay
      setTimeout(() => {
        mockSocket.connect();
      }, 200);

      return mockSocket;
    };
  }, systemState);
}

/**
 * Blocks socket.io connection and prevents real data from overwriting mocks
 */
export async function blockSocketConnection(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Override socket.io to prevent real connections
    const originalIO = (window as any).io;
    (window as any).io = function (url: string, options: any) {
      // Return a mock socket that never connects
      return {
        connected: false,
        id: null,
        on: function () {
          return this;
        },
        off: function () {
          return this;
        },
        emit: function () {
          return this;
        },
        connect: function () {
          return this;
        },
        disconnect: function () {
          return this;
        },
      };
    };

    // Mark that we're in test mode
    (window as any).__MCPX_TEST_MODE__ = true;
  });
}

/**
 * Sets up a listener to continuously overwrite system state with mock data
 * This prevents real socket data from overwriting the mock
 */
export async function setupStateOverwriteListener(
  page: Page,
  systemState: SystemState,
): Promise<void> {
  await page.evaluate((state) => {
    const store = (window as any).__MCPX_SOCKET_STORE__;
    if (!store) return;

    // Subscribe to store changes and overwrite with mock state
    const unsubscribe = store.subscribe((currentState: any) => {
      // If systemState changes and it's not our mock, overwrite it
      if (currentState.systemState !== state) {
        store.setState({ systemState: state });
      }
    });

    // Store unsubscribe function so we can clean up if needed
    (window as any).__MCPX_MOCK_UNSUBSCRIBE__ = unsubscribe;
  }, systemState);
}

/**
 * Sets appConfig in the socket store
 */
export async function setAppConfig(page: Page, appConfig: any): Promise<void> {
  await page.waitForFunction(
    () => {
      return !!(window as any).__MCPX_SOCKET_STORE__;
    },
    { timeout: TIMEOUT_10_SEC },
  );

  await page.evaluate((config) => {
    const store = (window as any).__MCPX_SOCKET_STORE__;
    if (store) {
      store.setState({ appConfig: config });
    }
  }, appConfig);

  await page.waitForTimeout(DELAY_1_SEC);
}

/**
 * Recommended approach: Block socket connection and set mock state
 * This prevents real data from overwriting the mock
 */
export async function setupMockedSystemState(
  page: Page,
  systemState: SystemState,
  appConfig?: any,
): Promise<void> {
  // Block socket.io connection before page loads
  await blockSocketConnection(page);

  // Navigate to dashboard
  await page.goto("/dashboard");

  // Wait for page to load and store to be available
  await page.waitForSelector('[class*="bg-gray-100"]', {
    timeout: TIMEOUT_10_SEC,
  });

  // Wait for the socket store to be exposed to window
  await page.waitForFunction(
    () => {
      return !!(window as any).__MCPX_SOCKET_STORE__;
    },
    { timeout: TIMEOUT_10_SEC },
  );

  // Set the system state directly via the exposed store
  await setSystemStateDirect(page, systemState);

  // Set appConfig if provided
  if (appConfig) {
    await setAppConfig(page, appConfig);
  }

  // Set up listener to prevent real data from overwriting
  await setupStateOverwriteListener(page, systemState);

  // Wait for state to propagate and React to re-render
  await page.waitForTimeout(DELAY_2_SEC);
}
