import { createHash } from "crypto";

/**
 * Recursively normalize objects and arrays to sorted structures for deterministic hashing.
 * This ensures that objects with the same content but different key/element order
 * produce the same hash.
 *
 * - Objects are converted to sorted arrays of [key, value] tuples
 * - Arrays are sorted by their JSON representation after normalization
 *
 * **IMPORTANT EDGE CASES:**
 * - Empty objects {} and empty arrays [] produce the SAME hash (both normalize to [])
 * - `undefined` values become `null` in JSON.stringify, so they hash identically
 * - Top-level `undefined` is not supported (use hashObject on objects/arrays/primitives only)
 */
export function normalizeForHashing(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map(normalizeForHashing)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }

  if (typeof obj === "object") {
    // Convert object to *sorted* array of [key, value] tuples
    return Object.entries(obj as Record<string, unknown>)
      .map(
        ([key, value]): [string, unknown] => [key, normalizeForHashing(value)],
      )
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  }

  return obj;
}

/**
 * Compute a SHA-256 hash of an object after normalizing it for deterministic hashing.
 */
export function hashObject(obj: unknown): string {
  const normalized = normalizeForHashing(obj);
  const jsonString = JSON.stringify(normalized);
  return createHash("sha256").update(jsonString).digest("hex");
}
