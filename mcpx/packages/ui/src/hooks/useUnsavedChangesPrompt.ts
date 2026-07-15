import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

const DEFAULT_MESSAGE = "You have unsaved changes. Leave without saving?";

export function useUnsavedChangesPrompt(
  isDirty: boolean,
  message = DEFAULT_MESSAGE,
) {
  const allowNextNavigationRef = useRef(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowNextNavigationRef.current) {
      allowNextNavigationRef.current = false;
      return false;
    }

    return (
      isDirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search ||
        currentLocation.hash !== nextLocation.hash)
    );
  });

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    if (window.confirm(message)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, message]);

  const allowNextNavigation = useCallback(() => {
    allowNextNavigationRef.current = true;
  }, []);

  return { allowNextNavigation };
}
