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
