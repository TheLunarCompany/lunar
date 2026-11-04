import McpxLogo from "@/components/dashboard/SystemConnectivity/nodes/Mcpx_Icon.svg?react";

type McpxBrandLogoProps = {
  placement: "sidebar" | "login";
  isBoomi: boolean;
};

export function McpxBrandLogo({ placement, isBoomi }: McpxBrandLogoProps) {
  if (isBoomi) {
    return (
      <img
        src={
          placement === "sidebar" ? "/boomi_logo.svg" : "/boomi_logo_login.svg"
        }
        alt="Boomi Logo"
        data-brand="boomi"
        className={placement === "sidebar" ? "size-10 shrink-0" : "size-24"}
      />
    );
  }

  if (placement === "login") {
    return (
      <img
        src="/favicon.svg"
        alt="MCPX Logo"
        data-brand="lunar"
        className="size-24"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label="MCPX Logo"
      data-brand="lunar"
      className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--mcpx-lunar-logo-background)] text-mcpx-tooltip-text shadow-[var(--mcpx-lunar-logo-shadow)]"
    >
      <McpxLogo className="size-5" />
    </div>
  );
}
