const availableColors = [
  "bg-[linear-gradient(135deg,var(--mcpx-data-blue)_0%,color-mix(in_srgb,var(--mcpx-data-blue)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--mcpx-data-green)_0%,color-mix(in_srgb,var(--mcpx-data-green)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--mcpx-data-coral)_0%,color-mix(in_srgb,var(--mcpx-data-coral)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--mcpx-data-purple)_0%,color-mix(in_srgb,var(--mcpx-data-purple)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--mcpx-data-navy)_0%,color-mix(in_srgb,var(--mcpx-data-navy)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--mcpx-data-periwinkle)_0%,color-mix(in_srgb,var(--mcpx-data-periwinkle)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--mcpx-data-gray)_0%,color-mix(in_srgb,var(--mcpx-data-gray)_82%,white)_100%)]",
] as const;

export function getAvatarBackgroundColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % availableColors.length;
  return availableColors[index];
}
