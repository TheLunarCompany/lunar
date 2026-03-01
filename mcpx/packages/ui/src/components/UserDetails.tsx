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
          <button className="w-full text-left">
            <div className="flex flex-row items-center gap-3 pl-2 rounded-lg hover:bg-gray-50 transition-colors min-w-0">
              <div className="w-9 h-9 bg-pink-500 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="text-sm truncate">{username}</div>
                <div className="text-sm text-gray-600 truncate">
                  {userEmail}
                </div>
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-[200px] mt-2 bg-white shadow-[0_6px_20px_0_rgba(30,27,75,0.20)] ml-[5px]"
          side="top"
          sideOffset={8}
        >
          <div className="flex flex-col items-center gap-3 bg-white p-2 py-4">
            <div className="w-[54px] h-[54px] bg-pink-500 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
              <User className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 min-w-0 w-full text-center px-2">
              <div className="text-md font-semibold truncate pb-1 w-full">
                {username}
              </div>
              <div className="text-xs text-gray-600 truncate w-full">
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
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {isAdmin ? "Enterprise Admin" : "Enterprise user"}
                </span>
              </div>
            </>
          )}

          <div className="px-2">
            <DropdownMenuSeparator />
          </div>

          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer focus:bg-transparent focus:text-current"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm text-gray-600">Log Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
