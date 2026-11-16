// A utility function to transform an the `e` in a general `catch(e)`
// clause into an Error.
export function makeError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(`Unknown error (${JSON.stringify(error)})`);
  }
  return error;
}

// Reads a property off an unknown value without narrowing it first.
// `message` and `name` live on Error's prototype chain, so a spread or
// Object.entries copy would miss them.
export function readProp(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;
}
