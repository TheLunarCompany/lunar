import { useEffect, useLayoutEffect } from "react";

import { isPendoEnabled } from "@/config/runtime-config";
import { useAuth } from "@/contexts/useAuth";
import { useBoomiAccount } from "@/hooks/useBoomiAccount";
import { installPendo, preparePendo, suspendPendo } from "./pendo";

export function PendoBootstrap(): null {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const {
    data: boomiAccount,
    isPending,
    isFetching,
    isError,
  } = useBoomiAccount();
  const email = user?.email ?? "";
  const accountId = boomiAccount?.accountId;

  useLayoutEffect(() => {
    if (
      !isPendoEnabled() ||
      authLoading ||
      !isAuthenticated ||
      !email ||
      isError ||
      (!isPending && (isFetching || !accountId))
    ) {
      suspendPendo();
      return;
    }

    preparePendo();
  }, [
    accountId,
    authLoading,
    email,
    isAuthenticated,
    isError,
    isFetching,
    isPending,
  ]);

  useEffect(() => {
    if (
      isPendoEnabled() &&
      isAuthenticated &&
      !authLoading &&
      !isError &&
      !isFetching &&
      !isPending &&
      email &&
      accountId
    ) {
      installPendo(email, accountId);
    }
  }, [
    accountId,
    authLoading,
    email,
    isAuthenticated,
    isError,
    isFetching,
    isPending,
  ]);

  useLayoutEffect(() => {
    return (): void => suspendPendo();
  }, []);

  return null;
}
