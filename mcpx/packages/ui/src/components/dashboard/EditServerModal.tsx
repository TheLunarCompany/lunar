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
import { Label } from "@/components/ui/label";
import McpIcon from "./SystemConnectivity/nodes/Mcpx_Icon.svg?react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useEditMcpServer } from "@/data/mcp-server";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useModalsStore } from "@/store";
import { validateAndProcessServer } from "@/utils/server-helpers";
import { mcpJsonSchema } from "@/utils/mcpJson";
import { TargetServerNew } from "@mcpx/shared-model";
import { AxiosError } from "axios";

import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { McpJsonForm } from "./McpJsonForm";
import { DEFAULT_SERVER_ICON } from "./constants";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { MCP_ICON_COLORS } from "./SystemConnectivity/nodes";
import { McpColorInput } from "./McpColorInput";

const getInitialJson = (initialData?: TargetServerNew): string => {
  if (!initialData) return "";
  switch (initialData._type) {
    case "stdio":
      return JSON.stringify(
        {
          [initialData.name]: {
            type: "stdio" as const,
            command: initialData.command,
            args: initialData.args,
            env: initialData.env || {},
            icon: initialData.icon || "⚙️",
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
            headers: initialData.headers || {},
            icon: initialData.icon || "⚙️",
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
            icon: initialData.icon || "⚙️",
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
  const { mutate: editServer, isPending, error } = useEditMcpServer();
  const [icon, setIcon] = useState(initialData?.icon || DEFAULT_SERVER_ICON);
  const [iconColors, setIconColors] = useState<string[]>(MCP_ICON_COLORS);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [jsonContent, setJsonContent] = useState(getInitialJson(initialData));
  const [errorMessage, setErrorMessage] = useState("");
  const [isValid, setIsValid] = useState(true);
  const isDirty = useMemo(
    () =>
      jsonContent.replaceAll(/\s/g, "").trim() !==
        getInitialJson(initialData).replaceAll(/\s/g, "").trim() ||
      icon !== initialData?.icon,
    [initialData, jsonContent, icon],
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
    // Use the shared validation and processing logic
    const result = validateAndProcessServer({
      jsonContent,
      icon: icon || DEFAULT_SERVER_ICON,
      isEdit: true,
      originalServerName: initialData?.name,
    });

    if (result.success === false) {
      setErrorMessage(
        result.error || "Failed to edit server. Please try again.",
      );
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
            description: `Server \"${initialData.name}\" was updated successfully.`,
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
    setJsonContent(getInitialJson({ ...initialData, icon }));
  }, [icon]);

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
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <div className="space-y-4">
          <DialogHeader className="border-b border-[var(--color-border-primary)] p-6">
            <DialogTitle className="flex items-center gap-2 text-2xl text-[var(--color-text-primary)]">
              <div>
                {domainIconUrl ? (
                  <img
                    src={domainIconUrl}
                    alt="Domain Icon"
                    className="min-w-12 w-12 min-h-12 h-12 rounded-xl object-contain p-2 bg-white"
                  />
                ) : (
                  <span>
                    <McpColorInput icon={icon} setIcon={setIcon} />
                  </span>
                )}
              </div>
              Edit Server <i>{initialData?.name}</i>
            </DialogTitle>
            <DialogDescription className="text-[var(--color-text-secondary)] mt-2">
              Edit MCP server configuration.{" "}
              <b>Server name cannot be changed.</b>
            </DialogDescription>
          </DialogHeader>
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
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-container-secondary)] animate-pulse">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-fg-interactive)] to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-fg-interactive)] via-transparent to-[var(--color-fg-interactive)] animate-[shimmer_1.5s_ease-in-out_infinite_reverse]" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-3 p-6 border-t border-[var(--color-border-primary)]">
            {onClose && (
              <Button
                variant="secondary"
                onClick={onClose}
                className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
                type="button"
              >
                Cancel
              </Button>
            )}
            <Button
              disabled={isPending || !isDirty || !isValid}
              className="bg-[var(--color-fg-interactive)] hover:enabled:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
