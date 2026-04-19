import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { editor } from "monaco-editor";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useEditMcpServer } from "@/data/mcp-server";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useModalsStore } from "@/store";
import { usePermissions } from "@/data/permissions";
import {
  normalizeServerName,
  validateAndProcessServer,
  validateServerCommand,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { mcpJsonSchema } from "@mcpx/toolkit-ui/src/utils/mcpJson";
import { EnvRequirement, EnvValue, TargetServer } from "@mcpx/shared-model";
import { AxiosError } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { McpJsonForm } from "./McpJsonForm";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { McpColorInput } from "./McpColorInput";
import { useGetMCPServers } from "@/data/catalog-servers";
import { maskSecretEnvValue } from "@mcpx/toolkit-ui/src/utils/env-vars-utils";

const getMaskedEnv = (
  initialEnv?: Record<string, EnvValue>,
  envRequirements?: Record<string, EnvRequirement>,
): Record<string, EnvValue> => {
  if (!initialEnv) {
    return {};
  }
  if (!envRequirements) {
    return initialEnv;
  }
  return Object.entries(initialEnv).reduce<Record<string, EnvValue>>(
    (maskedEnv, [key, value]) => {
      const requirement = envRequirements[key];
      maskedEnv[key] = requirement
        ? maskSecretEnvValue(value, requirement)
        : value;
      return maskedEnv;
    },
    {},
  );
};

const getInitialJson = (
  initialData?: TargetServer,
  envRequirements?: Record<string, EnvRequirement>,
): string => {
  if (!initialData) return "";
  switch (initialData._type) {
    case "stdio":
      return JSON.stringify(
        {
          [initialData.name]: {
            type: "stdio" as const,
            command: initialData.command,
            args: initialData.args,
            env: getMaskedEnv(initialData.env, envRequirements),
            icon: initialData.icon,
          },
        },
        null,
        2,
      );
    case "sse":
      return JSON.stringify(
        {
          [initialData.name]: {
            type: "sse" as const,
            url: initialData.url,
            headers: initialData.headers || undefined,
            icon: initialData.icon,
          },
        },
        null,
        2,
      );
    case "streamable-http":
      return JSON.stringify(
        {
          [initialData.name]: {
            type: "streamable-http" as const,
            url: initialData.url,
            headers: initialData.headers || {},
            icon: initialData.icon,
          },
        },
        null,
        2,
      );
    default:
      return "";
  }
};

export const EditServerModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { initialData } = useModalsStore((s) => ({
    initialData: s.editServerModalData,
  }));

  const { data: catalogServers } = useGetMCPServers();

  const envRequirements = useMemo(() => {
    if (
      !initialData ||
      initialData._type !== "stdio" ||
      !initialData.env ||
      !catalogServers ||
      !(Object.keys(initialData.env).length > 0)
    )
      return undefined;

    const normalizedName = normalizeServerName(initialData.name);
    const catalogMatchingServer = catalogServers.find(
      (s) => normalizeServerName(s.name) === normalizedName,
    );
    // we found a match, check for envReq
    if (catalogMatchingServer) {
      const serverConfig =
        catalogMatchingServer.config[catalogMatchingServer.name];
      if (serverConfig.type === "stdio") {
        return serverConfig.env;
      }
    }
    return undefined;
  }, [initialData, catalogServers]);

  const { canAddCustomServerAndEdit: canEditCustom } = usePermissions();
  const { mutate: editServer, isPending, error } = useEditMcpServer();
  const [icon, setIcon] = useState(initialData?.icon);
  const [jsonContent, setJsonContent] = useState(
    getInitialJson(initialData, envRequirements),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isValid, setIsValid] = useState(true);
  const isDirty = useMemo(
    () =>
      jsonContent.replaceAll(/\s/g, "").trim() !==
        getInitialJson(initialData, envRequirements)
          .replaceAll(/\s/g, "")
          .trim() || icon !== initialData?.icon,
    [initialData, jsonContent, icon, envRequirements],
  );
  const colorScheme = useColorScheme();
  const { toast } = useToast();

  const handleJsonChange = useCallback(
    (value: string) => {
      setJsonContent(value);
      if (errorMessage.length > 0) {
        setErrorMessage("");
      }
    },
    [errorMessage],
  );

  const handleValidate = useCallback((markers: editor.IMarker[]) => {
    setIsValid(markers.length === 0);
  }, []);

  const handleEditServer = () => {
    if (!canEditCustom) {
      setErrorMessage("Admin permissions required to edit servers.");
      return;
    }
    if (!initialData) {
      setErrorMessage("No server data available.");
      return;
    }

    // Use the shared validation and processing logic
    const result = validateAndProcessServer({
      jsonContent,
      icon: icon,
      isEdit: true,
      originalServerName: initialData.name,
    });

    if (!result.success || !result.payload) {
      setErrorMessage(
        result.error || "Failed to edit server. Please try again.",
      );
      return;
    }

    const commandError = validateServerCommand(result.payload);
    if (commandError) {
      setErrorMessage(commandError);
      return;
    }

    // Update the JSON content to include the type
    if (result.updatedJsonContent) {
      setJsonContent(result.updatedJsonContent);
    }

    editServer(
      {
        name: initialData.name,
        payload: result.payload,
      },
      {
        onSuccess: () => {
          toast({
            description: (
              <>
                Server{" "}
                <strong>
                  {initialData.name.charAt(0).toUpperCase() +
                    initialData.name.slice(1)}
                </strong>{" "}
                was updated successfully.
              </>
            ),
            title: "Server Edited",
          });
          onClose();
        },
        onError: (error) => {
          setErrorMessage(
            error?.message || "Failed to edit server. Please try again.",
          );
        },
      },
    );
  };

  useEffect(() => {
    if (initialData) {
      setJsonContent(getInitialJson({ ...initialData, icon }, envRequirements));
    }
  }, [icon, initialData, envRequirements]);

  useEffect(() => {
    if (!error) return;

    const message =
      error instanceof AxiosError && error.response?.data?.msg
        ? error.response.data.msg
        : "Failed to update server. Please try again.";

    setErrorMessage(message);
  }, [error]);

  const handleClose = () => {
    if (
      !isDirty ||
      confirm("Close Configuration? Changes you made have not been saved")
    ) {
      onClose?.();
    }
  };

  const domainIconUrl = useDomainIcon(initialData?.name || "");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open || handleClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col bg-card border border-border rounded-lg">
        <div className="space-y-4">
          <DialogHeader className="border-b border-border p-6">
            <DialogTitle className="flex items-center gap-2 text-2xl text-foreground">
              <div>
                {domainIconUrl ? (
                  <img
                    src={domainIconUrl}
                    alt="Domain Icon"
                    className="min-w-12 w-12 min-h-12 h-12 rounded-xl object-contain p-2 bg-white"
                  />
                ) : (
                  <span>
                    <McpColorInput icon={icon ?? ""} setIcon={setIcon} />
                  </span>
                )}
              </div>
              Edit Server <i>{initialData?.name}</i>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-2">
              Edit MCP server configuration.{" "}
              <b>Server name cannot be changed.</b>
            </DialogDescription>
          </DialogHeader>
          {canEditCustom && (
            <>
              <McpJsonForm
                colorScheme={colorScheme}
                errorMessage={errorMessage}
                onChange={handleJsonChange}
                schema={z.toJSONSchema(mcpJsonSchema)}
                value={jsonContent}
                onValidate={handleValidate}
              />
              {isPending && (
                <div className="px-6">
                  <div className="space-y-2">
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted animate-pulse">
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
                      <div className="absolute inset-0 bg-linear-to-r from-primary via-transparent to-primary animate-[shimmer_1.5s_ease-in-out_infinite_reverse]" />
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter className="gap-3 p-6 border-t border-border">
                {onClose && (
                  <Button
                    variant="secondary"
                    onClick={onClose}
                    className="border-ring text-primary hover:bg-accent"
                    type="button"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  disabled={isPending || !isDirty || !isValid}
                  className="bg-primary hover:enabled:bg-primary/80 text-primary-foreground"
                  onClick={handleEditServer}
                >
                  {isPending ? (
                    <>
                      Saving...
                      <Spinner />
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
