const VOWELS = new Set(["a", "e", "i", "o", "u"]);

export function pluralizeWithCount(count: number, singular: string): string {
  if (count === 1) return `1 ${singular}`;
  const last = singular.slice(-1);
  const secondLast = singular.slice(-2, -1);
  const plural =
    last === "y" && !VOWELS.has(secondLast)
      ? `${singular.slice(0, -1)}ies`
      : `${singular}s`;
  return `${count} ${plural}`;
}

export function pluralizeWithoutCount(count: number, singular: string): string {
  if (count === 1) return singular;
  const last = singular.slice(-1);
  const secondLast = singular.slice(-2, -1);
  const plural =
    last === "y" && !VOWELS.has(secondLast)
      ? `${singular.slice(0, -1)}ies`
      : `${singular}s`;
  return plural;
}
