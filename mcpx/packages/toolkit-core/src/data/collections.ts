// A function to remove `null`s and/or `undefined`s from an array
export function compact<X>(xs: Array<X | null | undefined>): X[] {
  return xs.flatMap((x) => (x ? [x] : []));
}

export function compactRecord<T>(
  record: Record<string, T | null | undefined>
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) =>
      value ? [[key, value]] : []
    )
  );
}
