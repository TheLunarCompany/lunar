import { cn } from "@/lib/utils";
import { Bot, FileText, Zap } from "lucide-react";

type SkillAnchorNavigationItem = {
  href: `#${string}`;
  label: string;
  icon?: "file" | "capabilities" | "agents";
};

type SkillAnchorNavigationProps = React.ComponentProps<"nav"> & {
  items: SkillAnchorNavigationItem[];
};

export function SkillAnchorNavigation({
  items,
  className,
  ...props
}: SkillAnchorNavigationProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Skill page sections"
      className={cn(
        "rounded-xl border border-mcpx-border-subtle bg-mcpx-surface px-5 py-4 shadow-sm",
        className,
      )}
      {...props}
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-mcpx-text-secondary">
        On this page
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="inline-flex h-8 w-full items-center gap-2 rounded-lg text-sm font-medium text-mcpx-text-secondary transition hover:text-mcpx-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <SkillAnchorIcon type={item.icon} />
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SkillAnchorIcon({
  type,
}: {
  type?: SkillAnchorNavigationItem["icon"];
}) {
  const className = "size-4 shrink-0 text-mcpx-text-secondary";

  if (type === "capabilities") {
    return <Zap className={className} />;
  }

  if (type === "agents") {
    return <Bot className={className} />;
  }

  return <FileText className={className} />;
}
