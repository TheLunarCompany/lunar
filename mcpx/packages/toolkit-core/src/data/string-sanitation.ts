/**
 * Simple, stable filename sanitizer.
 * Covers common invalid chars, trims, avoids hidden files.
 */
export function sanitizeFilename(input: string): string {
  const replacement = "_";
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  let name = input
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, replacement) // invalid on Windows
    .replace(/\s+/g, " ") // collapse whitespace
    .trim()
    .replace(/^\.+/, "") // no leading dots
    .replace(/[. ]+$/g, "") // no trailing dot or space
    .replace(/_{2,}/g, "_"); // collapse replacements

  if (!name) name = "untitled";
  if (reserved.test(name)) name = `_${name}`;

  // predictable length limit
  if (name.length > 120) name = name.slice(0, 120);

  return name;
}
