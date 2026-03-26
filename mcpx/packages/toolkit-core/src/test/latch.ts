export interface Latch {
  promise: Promise<void>;
  resolve: () => void;
}

/** Creates a one-shot promise gate. Call resolve() to unblock anyone awaiting promise. */
export function createLatch(): Latch {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
