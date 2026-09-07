import { ScopeSubject, scopeSubjectKey } from "@mcpx/shared-model";
import { CapabilityKind } from "./capability-registry.js";

// Capability scoping: what a subject is allowed to see, in item-identity space
// (catalogItemId-keyed). Pure data-in/data-out; translation of server names to
// catalog item ids happens at the caller's boundary.
//
// Skills are currently the only provider of capability groups: CapabilityGroupItem
// structurally matches SkillCapabilityGroupItem, so a skill's items pass straight in.

export interface CapabilityGroupItem {
  catalogItemId: string;
  tools: string[] | "*";
  prompts: string[] | "*";
}

export interface ScopedGroups {
  subject: ScopeSubject;
  groupItems: CapabilityGroupItem[];
}

type CapabilitySelection = "*" | Set<string>;

interface ItemScope {
  tools: CapabilitySelection;
  prompts: CapabilitySelection;
}

// One subject's allowance, keyed by catalogItemId.
export type SubjectScope = ReadonlyMap<string, ItemScope>;

// Keyed by scopeSubjectKey. A subject with no entry is unrestricted.
export type ScopeIndex = ReadonlyMap<string, SubjectScope>;

// Union across all group items of all of a subject's enabled groups:
// "*" absorbs lists, lists merge. Entries with no items are dropped —
// a subject whose enabled groups select nothing is unrestricted.
export function buildScopeIndex(entries: ScopedGroups[]): ScopeIndex {
  const index = new Map<string, SubjectScope>();
  for (const { subject, groupItems } of entries) {
    if (!groupItems.length) continue;
    index.set(scopeSubjectKey(subject), buildSubjectScope(groupItems));
  }
  return index;
}

export function subjectScopeAllows(props: {
  scope: SubjectScope;
  kind: CapabilityKind;
  catalogItemId: string;
  capability: string;
}): boolean {
  const { scope, kind, catalogItemId, capability } = props;
  const itemScope = scope.get(catalogItemId);
  if (!itemScope) {
    // catalogItemId is not selected by any group for this subject; deny.
    return false;
  }
  const selection = selectionFor(itemScope, kind);
  if (!selection) {
    // This kind is not selected by any group for this subject; deny.
    return false;
  }
  // If the selection is "*", all capabilities are allowed. Otherwise, check if the capability is in the set.
  return selection === "*" || selection.has(capability);
}

function buildSubjectScope(groupItems: CapabilityGroupItem[]): SubjectScope {
  const scope = new Map<string, ItemScope>();
  for (const item of groupItems) {
    const current = scope.get(item.catalogItemId);
    const incoming = {
      tools: toSelection(item.tools),
      prompts: toSelection(item.prompts),
    };
    scope.set(
      item.catalogItemId,
      current ? mergeItemScopes(current, incoming) : incoming,
    );
  }
  return scope;
}

function toSelection(names: string[] | "*"): CapabilitySelection {
  return names === "*" ? "*" : new Set(names);
}

function mergeItemScopes(a: ItemScope, b: ItemScope): ItemScope {
  return {
    tools: mergeSelections(a.tools, b.tools),
    prompts: mergeSelections(a.prompts, b.prompts),
  };
}

function mergeSelections(
  a: CapabilitySelection,
  b: CapabilitySelection,
): CapabilitySelection {
  if (a === "*" || b === "*") return "*";
  return new Set([...a, ...b]);
}

// Groups select tools and prompts; other kinds are never granted by scope.
function selectionFor(
  itemScope: ItemScope,
  kind: CapabilityKind,
): CapabilitySelection | undefined {
  switch (kind) {
    case "tools":
      return itemScope.tools;
    case "prompts":
      return itemScope.prompts;
    case "resources":
      return undefined;
  }
}
