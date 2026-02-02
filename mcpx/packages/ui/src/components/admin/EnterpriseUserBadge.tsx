import { Building2 } from "lucide-react";
import { FC } from "react";

export const EnterpriseUserBadge: FC = () => (
  <div className="flex items-center gap-2 px-3 py-2">
    <Building2 className="h-4 w-4 text-gray-500" />
    <span className="text-sm text-gray-600">Enterprise user</span>
  </div>
);
