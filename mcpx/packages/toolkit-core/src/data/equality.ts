export function stringifyEq<T>(a: T, b: T): boolean {
  const replacer = (_key: string, value: unknown): unknown => {
    if (value instanceof Set) return [...value].sort();
    if (value instanceof Map) return [...value.entries()].sort();
    if (value instanceof Date) return value.toISOString();
    return value;
  };

  return JSON.stringify(a, replacer) === JSON.stringify(b, replacer);
}
