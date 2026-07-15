import { FC, useEffect, useRef } from "react";
import { Identity } from "@mcpx/shared-model";
import { useIdentity } from "@/data/identity";

// Set once per tab before an auto-reload, so a reload that lands on the same
// stale view falls back to the manual button instead of looping.
const RELOAD_FLAG = "obo-actor-guard-reloaded";

// Brief pause so the user sees why the tab is reloading.
const RELOAD_DELAY_MS = 1000;

type OboGuardAction = "wait" | "none" | "reload" | "block";

// A space MCPX is workable only while edited (editedBy set); an admin's own MCPX
// only while not editing a space elsewhere (editingOnBehalfOf unset). Anything
// else is stale: this tab's socket points at an MCPX it should no longer drive.
// undefined means identity hasn't loaded yet, so staleness is still unknown.
function isStaleOboTab(identity: Identity | undefined): boolean | undefined {
  if (!identity) {
    return undefined;
  }
  if (identity.mode === "personal") {
    return false;
  }
  if (identity.entity.entityType === "space") {
    return !identity.entity.editedBy;
  }
  return !!identity.entity.editingOnBehalfOf;
}

// First time a tab goes stale, reload it (routing sends it to the right MCPX).
// If it comes back still stale, block and let the user reload by hand. While
// staleness is unknown (identity not loaded), do nothing so a reload's load
// window can't clear the one-shot flag and loop.
function decideOboGuardAction(params: {
  isStale: boolean | undefined;
  alreadyReloaded: boolean;
}): OboGuardAction {
  if (params.isStale === undefined) {
    return "wait";
  }
  if (!params.isStale) {
    return "none";
  }
  return params.alreadyReloaded ? "block" : "reload";
}

interface OboActorGuardProps {
  reload?: () => void;
}

// Hard-stops a tab whose OBO state makes it stale (a space whose edit ended, or
// an admin's own MCPX once they started editing a space elsewhere): reloads once
// to route it to the right MCPX, then blocks with a manual reload if that fails.
export const OboActorGuard: FC<OboActorGuardProps> = ({
  reload = () => window.location.reload(),
}) => {
  const { data } = useIdentity();
  const action = decideOboGuardAction({
    isStale: isStaleOboTab(data?.identity),
    alreadyReloaded: sessionStorage.getItem(RELOAD_FLAG) === "1",
  });

  // Keep the timer keyed only on `action`. The default `reload` is a fresh
  // closure each render, so depending on it would re-arm the timer on every
  // unrelated re-render (e.g. socket-driven Layout updates) and could starve the
  // auto-reload. The ref always points at the latest reload.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (action === "reload") {
      // Set the flag only as the reload actually fires, so the 1s pause can't be
      // misread as "already reloaded" and flip the action to "block".
      const timer = setTimeout(() => {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        reloadRef.current();
      }, RELOAD_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (action === "none") {
      sessionStorage.removeItem(RELOAD_FLAG);
    }
    return undefined;
  }, [action]);

  if (action !== "reload" && action !== "block") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/70 text-center text-white">
      <p className="text-lg font-semibold">This view is no longer active.</p>
      {action === "reload" ? (
        <p className="text-sm">Your editing session changed. Reloading…</p>
      ) : (
        <>
          <p className="text-sm">
            Your editing session changed. Reload to continue.
          </p>
          <button
            onClick={() => reload()}
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
          >
            Reload
          </button>
        </>
      )}
    </div>
  );
};
