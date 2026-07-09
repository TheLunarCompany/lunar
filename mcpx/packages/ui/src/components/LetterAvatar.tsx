import { cn } from "@/lib/utils";

const colorAssignments = new Map<string, string>();
const usedColors = new Set<string>();

const availableColors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-red-500",
  "bg-yellow-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-500",
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
      {getAvatarInitials(name)}
    </div>
  );
}

function getAvatarInitials(name: string): string {
  return name.substring(0, 2).toUpperCase();
}

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
