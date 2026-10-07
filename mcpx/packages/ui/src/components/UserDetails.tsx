import { useAuth } from "@/contexts/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StrictModeToggle } from "@/components/admin/StrictModeToggle";
import {
  useIdentity,
  isAdminIdentity,
  isEnterpriseIdentity,
} from "@/data/identity";
import { User, LogOut, Building2 } from "lucide-react";
import { FC } from "react";
import { useStrictness } from "@/data/strictness";

export const UserDetails: FC = () => {
  const { user, logout } = useAuth();
  const { data: identityData } = useIdentity();
  const { data, isLoading } = useStrictness();

  const identity = identityData?.identity;
  const isAdmin = identity ? isAdminIdentity(identity) : false;
  const isEnterprise = identity ? isEnterpriseIdentity(identity) : false;

  const username = user?.name || "User";
  const userEmail = user?.email || "";

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full cursor-pointer rounded-[var(--border-radius-sm)] text-left outline-hidden ring-sidebar-ring transition-colors hover:bg-[var(--mcpx-sidebar-active)] focus-visible:ring-2">
            <div className="flex min-w-0 flex-row items-center gap-3 p-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mcpx-surface shadow-none">
                <User className="size-5 text-[var(--mcpx-sidebar)]" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="truncate text-sm font-semibold text-[var(--mcpx-sidebar-text)]">
                  {username}
                </div>
                <div className="truncate text-xs text-[var(--mcpx-sidebar-text-muted)]">
                  {userEmail}
                </div>
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="mt-2 ml-[5px] w-[200px] bg-mcpx-surface shadow-[var(--mcpx-shadow-moderate)]"
          side="top"
          sideOffset={8}
        >
          <div className="flex flex-col items-center gap-3 bg-mcpx-surface p-2 py-4">
            <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-mcpx-action shadow-[var(--mcpx-shadow-weak)]">
              <User className="h-7 w-7 text-mcpx-tooltip-text" />
            </div>
            <div className="flex-1 min-w-0 w-full text-center px-2">
              <div className="text-md font-semibold truncate pb-1 w-full">
                {username}
              </div>
              <div className="w-full truncate text-xs text-mcpx-text-secondary">
                {userEmail}
              </div>
            </div>
          </div>

          {data?.strictnessFeatureEnabled &&
            isAdmin && ( // toggle is visible only when strictness is enabled and only for admins
              <>
                <div className="px-2">
                  <DropdownMenuSeparator />
                </div>
                <StrictModeToggle
                  isLoading={isLoading}
                  strictnessData={{
                    strictnessFeatureEnabled: true,
                    isStrict: data.isStrict,
                    adminOverride: data.adminOverride,
                  }}
                />
              </>
            )}

          {isEnterprise && (
            <>
              <div className="px-2">
                <DropdownMenuSeparator />
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <Building2 className="h-4 w-4 text-mcpx-text-secondary" />
                <span className="text-sm text-mcpx-text-secondary">
                  {isAdmin ? "Enterprise Admin" : "Enterprise user"}
                </span>
              </div>
            </>
          )}

          <div className="px-2">
            <DropdownMenuSeparator />
          </div>

          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm text-mcpx-text-secondary">Log Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
