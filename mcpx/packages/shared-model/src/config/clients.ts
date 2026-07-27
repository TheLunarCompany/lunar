
// =======================
// Agents canonical names and different identifiers names they use
// update here when adding support for a new agent in mcpx
//
// Matching is case-insensitive substring based: a client name matches the first entry
// whose patterns array contains a string that appears anywhere in the client name.
//
// ORDER MATTERS — first match wins. Entries with broader patterns (e.g. "claude")
// must come AFTER entries with more specific ones (e.g. "claude-code"), otherwise
// the broader pattern shadows the specific one and the specific entry is never reached.
// =======================
export interface NameNormalizationEntry {
  canonicalName: string;
  patterns: string[];
}

export const AGENT_REGISTRY: NameNormalizationEntry[] = [
  { canonicalName: "Cursor",         patterns: ["cursor"] },
  { canonicalName: "VSCode",         patterns: ["vscode", "vs-code" ,"vs code", "visual studio code"] },
  { canonicalName: "Claude Code",    patterns: ["claude-code", "claude code"] },
  { canonicalName: "Claude Desktop", patterns: ["claude", "anthropic"] },
  { canonicalName: "Copilot",        patterns: ["copilot"] },
  { canonicalName: "ChatGPT",        patterns: ["openai", "chatgpt"] },
  { canonicalName: "Codex",          patterns: ["codex"] },
  { canonicalName: "Warp",           patterns: ["warp"] },
  { canonicalName: "Windsurf",       patterns: ["windsurf"] },
  { canonicalName: "Gemini CLI",     patterns: ["gemini"] },
  { canonicalName: "OpenCode",       patterns: ["opencode"] },
  { canonicalName: "N8N",            patterns: ["n8n"] },
  { canonicalName: "Inspector",      patterns: ["inspector"] },
  { canonicalName: "Lunar orbiter",  patterns: ["orbiter"] }, // lunars inner qa agent 

];

//============================================================
// Generic canonical name by sub string resolver- takes the raw name and normalization entries
// and returns a canonical name if found a match
//============================================================

export function resolveCanonicalName(
  rawName: string,
  entries: NameNormalizationEntry[],
): string {
  const lower = rawName.toLowerCase();
  // Case-*in*sensitive substring match: first canonical name whose patterns array
  // contains a string that appears anywhere in `lower` wins.
  const match = entries.find((canonName) =>
    canonName.patterns.some((pattern) => lower.includes(pattern)),
  );
  return match?.canonicalName ?? rawName; // default to raw client name if no match was found
}