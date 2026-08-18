import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const colorAssignments = new Map<string, string>();
const usedColors = new Set<string>();

const availableColors = [
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-periwinkle)_0%,color-mix(in_srgb,var(--skill-avatar-bg-periwinkle)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-emerald)_0%,color-mix(in_srgb,var(--skill-avatar-bg-emerald)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-lunar)_0%,color-mix(in_srgb,var(--skill-avatar-bg-lunar)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-orchid)_0%,color-mix(in_srgb,var(--skill-avatar-bg-orchid)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-indigo)_0%,color-mix(in_srgb,var(--skill-avatar-bg-indigo)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-raspberry)_0%,color-mix(in_srgb,var(--skill-avatar-bg-raspberry)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-gold)_0%,color-mix(in_srgb,var(--skill-avatar-bg-gold)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-teal)_0%,color-mix(in_srgb,var(--skill-avatar-bg-teal)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-coral)_0%,color-mix(in_srgb,var(--skill-avatar-bg-coral)_82%,white)_100%)]",
  "bg-[linear-gradient(135deg,var(--skill-avatar-bg-azure)_0%,color-mix(in_srgb,var(--skill-avatar-bg-azure)_82%,white)_100%)]",
] as const;

type LetterAvatarProps = {
  name: string;
  className?: string;
};

export function LetterAvatar({ name, className }: LetterAvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        getAvatarBackgroundColor(name),
        "flex size-10 shrink-0 items-center justify-center rounded-lg text-lg font-medium text-white",
        className,
      )}
    >
      {/* {getAvatarInitials(name)} */}
      <Sparkles
        className="size-5 text-white drop-shadow-sm"
        strokeWidth={2.2}
      />
    </div>
  );
}

// function getAvatarInitials(name: string): string {
//   return name.substring(0, 2).toUpperCase();
// }

function getAvatarBackgroundColor(name: string): string {
  if (colorAssignments.has(name)) {
    return colorAssignments.get(name)!;
  }

  const availableColor = availableColors.find(
    (color) => !usedColors.has(color),
  );

  if (availableColor) {
    colorAssignments.set(name, availableColor);
    usedColors.add(availableColor);
    return availableColor;
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % availableColors.length;
  const fallbackColor = availableColors[index] as string;
  colorAssignments.set(name, fallbackColor);
  return fallbackColor;
}
