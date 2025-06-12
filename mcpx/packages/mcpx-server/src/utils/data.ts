// A function to remove `null`s and/or `undefined`s from an array
export function compact<X>(xs: Array<X | null | undefined>): X[] {
  return xs.flatMap((x) => (x ? [x] : []));
}

export function stringifyEq<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
