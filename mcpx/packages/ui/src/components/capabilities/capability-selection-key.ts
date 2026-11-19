import type { CapabilitySelectionKey } from "./types";

export function buildCapabilitySelectionKey(
  providerName: string,
  itemName: string,
): CapabilitySelectionKey {
  return `${encodeURIComponent(providerName)}:${encodeURIComponent(itemName)}`;
}

export function splitCapabilitySelectionKey(key: CapabilitySelectionKey): {
  providerName: string;
  itemName: string;
} {
  const separatorIndex = key.indexOf(":");

  return {
    providerName: decodeURIComponent(key.slice(0, separatorIndex)),
    itemName: decodeURIComponent(key.slice(separatorIndex + 1)),
  };
}
