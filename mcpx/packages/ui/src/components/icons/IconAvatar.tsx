import { cn } from "@/lib/utils";
import { useMemo } from "react";

// Import all avatar icons (same set as admin-ui space-card-avatar-icons)
import icon4dots1 from "./space-card-avatar-icons/4dots-1.svg";
import icon4dots2 from "./space-card-avatar-icons/4dots-2.svg";
import icon4dots3 from "./space-card-avatar-icons/4dots-3.svg";
import icon4dots4 from "./space-card-avatar-icons/4dots-4.svg";
import icon4dots5 from "./space-card-avatar-icons/4dots-5.svg";
import icon4dots6 from "./space-card-avatar-icons/4dots-6.svg";
import icon5dots1 from "./space-card-avatar-icons/5dots-1.svg";
import icon5dots2 from "./space-card-avatar-icons/5dots-2.svg";
import icon5dots3 from "./space-card-avatar-icons/5dots-3.svg";
import icon5dots4 from "./space-card-avatar-icons/5dots-4.svg";
import icon5dots5 from "./space-card-avatar-icons/5dots-5.svg";
import icon5dots6 from "./space-card-avatar-icons/5dots-6.svg";
import iconDown3dots1 from "./space-card-avatar-icons/down3dots-1.svg";
import iconDown3dots2 from "./space-card-avatar-icons/down3dots-2.svg";
import iconDown3dots3 from "./space-card-avatar-icons/down3dots-3.svg";
import iconDown3dots4 from "./space-card-avatar-icons/down3dots-4.svg";
import iconDown3dots5 from "./space-card-avatar-icons/down3dots-5.svg";
import iconDown3dots6 from "./space-card-avatar-icons/down3dots-6.svg";
import iconLeft3dots1 from "./space-card-avatar-icons/left3dots-1.svg";
import iconLeft3dots2 from "./space-card-avatar-icons/left3dots-2.svg";
import iconLeft3dots3 from "./space-card-avatar-icons/left3dots-3.svg";
import iconLeft3dots4 from "./space-card-avatar-icons/left3dots-4.svg";
import iconLeft3dots5 from "./space-card-avatar-icons/left3dots-5.svg";
import iconLeft3dots6 from "./space-card-avatar-icons/left3dots-6.svg";
import iconRight3dots1 from "./space-card-avatar-icons/right3dots-1.svg";
import iconRight3dots2 from "./space-card-avatar-icons/right3dots-2.svg";
import iconRight3dots3 from "./space-card-avatar-icons/right3dots-3.svg";
import iconRight3dots4 from "./space-card-avatar-icons/right3dots-4.svg";
import iconRight3dots5 from "./space-card-avatar-icons/right3dots-5.svg";
import iconRight3dots6 from "./space-card-avatar-icons/right3dots-6.svg";
import iconUp3dots1 from "./space-card-avatar-icons/up3dots-1.svg";
import iconUp3dots2 from "./space-card-avatar-icons/up3dots-2.svg";
import iconUp3dots3 from "./space-card-avatar-icons/up3dots-3.svg";
import iconUp3dots4 from "./space-card-avatar-icons/up3dots-4.svg";
import iconUp3dots5 from "./space-card-avatar-icons/up3dots-5.svg";
import iconUp3dots6 from "./space-card-avatar-icons/up3dots-6.svg";
import iconVertical3dots1 from "./space-card-avatar-icons/vertical3dots-1.svg";
import iconVertical3dots2 from "./space-card-avatar-icons/vertical3dots-2.svg";
import iconVertical3dots3 from "./space-card-avatar-icons/vertical3dots-3.svg";
import iconVertical3dots4 from "./space-card-avatar-icons/vertical3dots-4.svg";
import iconVertical3dots5 from "./space-card-avatar-icons/vertical3dots-5.svg";
import iconVertical3dots6 from "./space-card-avatar-icons/vertical3dots6.svg";
import iconVertical4dots1 from "./space-card-avatar-icons/vertical4dots-1.svg";
import iconVertical4dots2 from "./space-card-avatar-icons/vertical4dots-2.svg";
import iconVertical4dots3 from "./space-card-avatar-icons/vertical4dots-3.svg";
import iconVertical4dots4 from "./space-card-avatar-icons/vertical4dots-4.svg";
import iconVertical4dots5 from "./space-card-avatar-icons/vertical4dots-5.svg";
import iconVertical4dots6 from "./space-card-avatar-icons/vertical4dots-6.svg";
import iconVerticalleft3dots1 from "./space-card-avatar-icons/verticalleft3dots-1.svg";
import iconVerticalleft3dots2 from "./space-card-avatar-icons/verticalleft3dots-2.svg";
import iconVerticalleft3dots3 from "./space-card-avatar-icons/verticalleft3dots-3.svg";
import iconVerticalleft3dots4 from "./space-card-avatar-icons/verticalleft3dots-4.svg";
import iconVerticalleft3dots5 from "./space-card-avatar-icons/verticalleft3dots-5.svg";
import iconVerticalleft3dots6 from "./space-card-avatar-icons/verticalleft3dots-6.svg";

const AVATAR_ICONS = [
  icon4dots1,
  icon4dots2,
  icon4dots3,
  icon4dots4,
  icon4dots5,
  icon4dots6,
  icon5dots1,
  icon5dots2,
  icon5dots3,
  icon5dots4,
  icon5dots5,
  icon5dots6,
  iconDown3dots1,
  iconDown3dots2,
  iconDown3dots3,
  iconDown3dots4,
  iconDown3dots5,
  iconDown3dots6,
  iconLeft3dots1,
  iconLeft3dots2,
  iconLeft3dots3,
  iconLeft3dots4,
  iconLeft3dots5,
  iconLeft3dots6,
  iconRight3dots1,
  iconRight3dots2,
  iconRight3dots3,
  iconRight3dots4,
  iconRight3dots5,
  iconRight3dots6,
  iconUp3dots1,
  iconUp3dots2,
  iconUp3dots3,
  iconUp3dots4,
  iconUp3dots5,
  iconUp3dots6,
  iconVertical3dots1,
  iconVertical3dots2,
  iconVertical3dots3,
  iconVertical3dots4,
  iconVertical3dots5,
  iconVertical3dots6,
  iconVertical4dots1,
  iconVertical4dots2,
  iconVertical4dots3,
  iconVertical4dots4,
  iconVertical4dots5,
  iconVertical4dots6,
  iconVerticalleft3dots1,
  iconVerticalleft3dots2,
  iconVerticalleft3dots3,
  iconVerticalleft3dots4,
  iconVerticalleft3dots5,
  iconVerticalleft3dots6,
];

/** Deterministic index from a string or number seed (same algorithm as admin-ui IconAvatar). */
function getIconIndex(seed: string | number): number {
  const seedValue =
    typeof seed === "string"
      ? seed.split("").reduce((acc, char) => {
          const hash = acc + char.charCodeAt(0);
          return hash + (hash << 10) + (hash >> 6);
        }, 0)
      : seed;
  return Math.abs(seedValue) % AVATAR_ICONS.length;
}

export interface IconAvatarProps {
  className?: string;
  size?: number;
  /** Optional seed for deterministic icon (e.g. card title or id). Without seed, icon is random. */
  seed?: string | number;
}

export function IconAvatar({
  className,
  size = 20,
  seed,
}: IconAvatarProps): React.ReactElement {
  const selectedIcon = useMemo(() => {
    if (seed !== undefined) {
      const index = getIconIndex(seed);
      return AVATAR_ICONS[index];
    }
    const index = Math.floor(Math.random() * AVATAR_ICONS.length);
    return AVATAR_ICONS[index];
  }, [seed]);

  return (
    <div
      className={cn(
        "shrink-0 rounded-lg border border-[#D8DCED] bg-white flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <img
        src={selectedIcon}
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
