// A function to remove `null`s and/or `undefined`s from an array (immutable)
export function compact<X>(xs: Array<X | null | undefined>): X[] {
  return xs.flatMap((x) => (x ? [x] : []));
}

// A function to remove `null`s and/or `undefined`s from an object (immutable)
export function compactRecord<T>(
  record: Record<string, T | null | undefined>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) =>
      value ? [[key, value]] : [],
    ),
  );
}

// A function to index array items by a string that can be
// extracted from each item. In case of plural items, the last item
// will be used for the index.
// (immutable)
export function indexBy<X>(
  xs: X[],
  groupByF: (x: X) => string,
): { [group: string]: X } {
  return xs.reduce<{ [group: string]: X }>((res, item) => {
    const group = groupByF(item);
    res[group] = item;
    return res;
  }, {});
}

// A function to group array items by a string that can be
// extracted from each item
export function groupBy<X>(
  xs: X[],
  groupByF: (x: X) => string,
): { [group: string]: X[] } {
  return xs.reduce<{ [group: string]: X[] }>((res, item) => {
    const group = groupByF(item);
    res[group] = [...(res[group] || []), item];
    return res;
  }, {});
}

// Split an array into chunks of a given size
export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) return [];
  return array.reduce<T[][]>((acc, item, index) => {
    if (index % size === 0) {
      return [...acc, [item]];
    }
    const lastChunk = acc[acc.length - 1] ?? [];
    return [...acc.slice(0, -1), [...lastChunk, item]];
  }, []);
}
export function mapValues<A, B>(
  obj: Record<string, A>,
  mapF: (a: A) => B,
): Record<string, B> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, mapF(value)]),
  );
}
