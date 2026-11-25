import { FC, ReactNode, useState } from "react";
import { Lock, LucideIcon, Pencil } from "lucide-react";
import {
  useIdentity,
  getSpaceEditedByLabel,
  getSpaceKind,
  getSpaceKindLabel,
  getSpaceName,
  SpaceKind,
} from "@/data/identity";
import { finishObo } from "@/lib/api";
import { getAdminWebserverURL } from "@/config/api-config";
import { useToast } from "@/components/ui/use-toast";

interface MessageProps {
  kindLabel: string;
  spaceName: string | undefined;
  editedBy: ReactNode;
}

// What the banner says about the OBO holding this space, by space kind.
interface BannerCopy {
  icon: LucideIcon;
  message: (props: MessageProps) => ReactNode;
  exit: {
    action: string;
    pending: string;
    failureTitle: string;
    failureDescription: string;
  };
}

const EDIT: BannerCopy = {
  icon: Pencil,
  message: ({ kindLabel, spaceName, editedBy }) => (
    <>
      This {kindLabel}
      {spaceName ? <span className="font-bold"> "{spaceName}"</span> : null} is
      currently being edited by {editedBy} on its behalf.
    </>
  ),
  exit: {
    action: "End editing",
    pending: "Ending...",
    failureTitle: "Could not end editing",
    failureDescription: "End the edit from the admin UI instead.",
  },
};

const SCAN_AUTHORIZATION: BannerCopy = {
  icon: Lock,
  message: ({ editedBy }) => (
    <>
      A catalog scan is waiting for authorization by {editedBy}. This MCPX is
      locked until it finishes.
    </>
  ),
  exit: {
    action: "Cancel authorization",
    pending: "Cancelling...",
    failureTitle: "Could not cancel authorization",
    failureDescription: "Cancel it from the admin UI instead.",
  },
};

const BANNER_BY_KIND: Record<SpaceKind, BannerCopy> = {
  HOSTED_MCP_SERVER: EDIT,
  AGENT_CONNECTOR: EDIT,
  SANDBOX_ANALYSIS: SCAN_AUTHORIZATION,
};

// High-visibility, full-width bar shown while an admin holds this space on its
// behalf (OBO). Intentionally loud and unmissable
export const OboEditBanner: FC<{ exitObo?: () => Promise<void> }> = ({
  exitObo = finishObo,
}) => {
  const { data: identityData } = useIdentity();
  const { toast } = useToast();
  const [isEnding, setIsEnding] = useState(false);
  const identity = identityData?.identity;
  const editedByLabel = identity ? getSpaceEditedByLabel(identity) : undefined;
  const kindLabel = identity ? getSpaceKindLabel(identity) : "space";
  const spaceName = identity ? getSpaceName(identity) : undefined;
  const kind = identity ? getSpaceKind(identity) : undefined;
  const copy = kind ? BANNER_BY_KIND[kind] : EDIT;
  // The banner only renders while this space is under OBO (editedBy below), so
  // the button is inherently space-only; this just needs the webserver base.
  const canEnd = getAdminWebserverURL() !== null;

  if (!editedByLabel) {
    return null;
  }

  const endEditing = async (): Promise<void> => {
    setIsEnding(true);
    try {
      await exitObo();
      // The OboActorGuard takes over once the identity flips.
    } catch {
      toast({
        title: copy.exit.failureTitle,
        description: copy.exit.failureDescription,
        variant: "destructive",
      });
      setIsEnding(false);
    }
  };

  const Icon = copy.icon;
  return (
    <div className="flex w-full items-center justify-center gap-2 bg-mcpx-warning-bg px-4 py-2 text-center text-sm font-semibold text-mcpx-text shadow-[var(--mcpx-shadow-weak)]">
      <Icon className="h-4 w-4 shrink-0" />
      <span>
        {copy.message({
          kindLabel,
          spaceName,
          editedBy: (
            <span className="font-bold underline">{editedByLabel}</span>
          ),
        })}
      </span>
      {canEnd ? (
        <button
          onClick={() => void endEditing()}
          disabled={isEnding}
          className="ml-2 shrink-0 rounded-md bg-mcpx-warning-strong px-3 py-1 text-xs font-semibold text-mcpx-tooltip-text hover:bg-mcpx-action disabled:cursor-not-allowed disabled:bg-mcpx-surface-disabled disabled:text-mcpx-text-disabled"
        >
          {isEnding ? copy.exit.pending : copy.exit.action}
        </button>
      ) : null}
    </div>
  );
};
