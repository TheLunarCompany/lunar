import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { getAvatarBackgroundColor } from "./letter-avatar-colors";

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
        "flex size-10 shrink-0 items-center justify-center rounded-lg text-lg font-medium text-primary-foreground",
        className,
      )}
    >
      {/* {getAvatarInitials(name)} */}
      <Sparkles
        className="size-5 text-primary-foreground drop-shadow-sm"
        strokeWidth={2.2}
      />
    </div>
  );
}
