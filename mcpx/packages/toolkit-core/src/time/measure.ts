import { makeError } from "../data/index.js";

export type Measurement<T> =
  | { duration: number; success: true; result: T }
  | { duration: number; success: false; error: Error };

// This function measures the execution time of an asynchronous function
// and returns a Measurement object containing the duration, success status,
// and either the result or an error.
// It is non-failable, meaning it will always return a Measurement object.
export async function measureNonFailable<T>(
  f: () => Promise<T>,
): Promise<Measurement<T>> {
  const start = performance.now();

  try {
    const result = await f();
    return {
      duration: performance.now() - start,
      success: true,
      result,
    };
  } catch (e) {
    const error = makeError(e);
    return {
      duration: performance.now() - start,
      success: false,
      error,
    };
  }
}
