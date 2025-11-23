// Recursively sort object keys and array elements for reliable comparison
export function normalizeForComparison(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => normalizeForComparison(item))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      result[key] = normalizeForComparison(
        (obj as Record<string, unknown>)[key]
      );
    }
    return result;
  }

  return obj;
}

export function toEqualNormalized(received: unknown, expected: unknown) {
  const normalizedReceived = normalizeForComparison(received);
  const normalizedExpected = normalizeForComparison(expected);
  expect(normalizedReceived).toEqual(normalizedExpected);
}
