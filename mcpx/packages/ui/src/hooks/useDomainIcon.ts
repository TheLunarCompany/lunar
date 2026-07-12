import {
  ICONIFY_BASE,
  MCP_ICON_URL,
  type ServerIconEntry,
  buildIconifyUrl,
  extractPrefix,
  lookupRegistryKey,
} from "@mcpx/toolkit-ui/src/utils/icons-utils";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const IconifyIconsResponseSchema = z.object({
  icons: z.record(z.string(), z.unknown()).optional(),
});

function entryToIconUrl(name: string, entry: ServerIconEntry): string {
  if (entry.kind === "local") return `/icons/${name}.png`;
  if (entry.kind === "custom")
    return buildIconifyUrl(entry.iconifyId, entry.color);
  return buildIconifyUrl(
    entry.withIcon ? `logos:${name}-icon` : `logos:${name}`,
  );
}

async function fetchDomainIconUrl(name: string): Promise<string> {
  const lowerName = name.toLowerCase();
  const res = await fetch(
    `${ICONIFY_BASE}/logos.json?icons=${encodeURIComponent(lowerName)},${encodeURIComponent(`${lowerName}-icon`)}`,
  );
  if (!res.ok) return MCP_ICON_URL(name);
  const parsed = IconifyIconsResponseSchema.safeParse(await res.json());
  if (!parsed.success) return MCP_ICON_URL(name);
  const icons = parsed.data.icons ?? {};
  if (`${lowerName}-icon` in icons)
    return buildIconifyUrl(`logos:${lowerName}-icon`);
  if (lowerName in icons) return buildIconifyUrl(`logos:${lowerName}`);
  return MCP_ICON_URL(name);
}

export const useDomainIcon = (name: string): string => {
  const lookupResult = name.length > 0 ? lookupRegistryKey(name) : null;

  // Only used on registry misses: extracts the brand token so the iconify fetch
  // targets "github" not "github-mcp", and cache is shared across name variants.
  const serverInferredName = lookupResult === null ? extractPrefix(name) : "";

  const { data } = useQuery({
    queryKey: ["domain-icon", serverInferredName],
    queryFn: () => fetchDomainIconUrl(serverInferredName),
    enabled: lookupResult === null && name !== "", // a name was given but no match was found
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  if (!name) return "";

  if (lookupResult) return entryToIconUrl(lookupResult.key, lookupResult.entry);
  return data ?? "";
};
