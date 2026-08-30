import { FC, useState } from "react";
import { Pencil } from "lucide-react";
import {
  useIdentity,
  getSpaceEditedByLabel,
  getSpaceKindLabel,
  getSpaceName,
} from "@/data/identity";
import { finishObo } from "@/lib/api";
import { getAdminWebserverURL } from "@/config/api-config";
import { useToast } from "@/components/ui/use-toast";

// High-visibility, full-width bar shown while an admin is editing this space on
// its behalf (OBO). Intentionally loud and unmissable
export const OboEditBanner: FC = () => {
  const { data: identityData } = useIdentity();
  const { toast } = useToast();
  const [isEnding, setIsEnding] = useState(false);
  const identity = identityData?.identity;
  const editedByLabel = identity ? getSpaceEditedByLabel(identity) : undefined;
  const kindLabel = identity ? getSpaceKindLabel(identity) : "space";
  const spaceName = identity ? getSpaceName(identity) : undefined;
  // The banner only renders while this space is under OBO (editedBy below), so
  // the button is inherently space-only; this just needs the webserver base.
  const canEnd = getAdminWebserverURL() !== null;

  if (!editedByLabel) {
    return null;
  }

  const endEditing = async (): Promise<void> => {
    setIsEnding(true);
    try {
      await finishObo();
      // The OboActorGuard takes over once the identity flips.
    } catch {
      toast({
        title: "Could not end editing",
        description: "End the edit from the admin UI instead.",
        variant: "destructive",
      });
      setIsEnding(false);
    }
  };

  return (
    <div className="flex w-full items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-md">
      <Pencil className="h-4 w-4 shrink-0" />
      <span>
        This {kindLabel}
        {spaceName ? (
          <span className="font-bold"> "{spaceName}"</span>
        ) : null}{" "}
        is currently being edited by{" "}
        <span className="font-bold underline">{editedByLabel}</span> on its
        behalf.
      </span>
      {canEnd ? (
        <button
          onClick={() => void endEditing()}
          disabled={isEnding}
          className="ml-2 shrink-0 rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900 disabled:opacity-60"
        >
          {isEnding ? "Ending..." : "End editing"}
        </button>
      ) : null}
    </div>
  );
};
