export function mergeScopes(...scopeLists: string[][]): string {
  return [...new Set(scopeLists.flat())].join(" ");
}
