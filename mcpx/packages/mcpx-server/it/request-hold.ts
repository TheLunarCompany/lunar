// A request a mock server holds until the test releases it, so a test can stop
// MCPX at a real boundary instead of spying on its classes.
export interface RequestHold {
  // Resolves once the held request has arrived.
  entered: Promise<void>;
  release: () => void;
}

// The mock side: `wait` marks the request as arrived and resolves on release.
export function createRequestHold(): {
  hold: RequestHold;
  wait: () => Promise<void>;
} {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    hold: { entered, release: () => release() },
    wait: () => {
      enter();
      return released;
    },
  };
}
