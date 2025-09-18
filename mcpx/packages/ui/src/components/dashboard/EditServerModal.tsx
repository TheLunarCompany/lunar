import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import {
  inferServerTypeFromUrl,
  mcpJsonSchema,
  parseServerPayload,
} from "@/utils/mcpJson";
import { TargetServerNew } from "@mcpx/shared-model";
import { AxiosError } from "axios";
import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { McpJsonForm } from "./McpJsonForm";
import { DEFAULT_SERVER_ICON } from "./constants";

const getInitialJson = (initialData?: TargetServerNew): string => {
  if (!initialData) return "";
  switch (initialData._type) {
    case "stdio":
      return JSON.stringify(
        {
          [initialData.name]: {
            command: initialData.command,
            args: initialData.args,
            env: initialData.env || {},
          },
        },
        null,
        2,
      );
    case "sse":
      return JSON.stringify(
        {
          [initialData.name]: {
            url: initialData.url,
            headers: initialData.headers || {},
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
          },
        },
        null,
        2,
      );
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
  const [icon, setIcon] = useState(initialData?.icon);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [jsonContent, setJsonContent] = useState(getInitialJson(initialData));
  const [errorMessage, setErrorMessage] = useState("");
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

  const handleEditServer = () => {
    if (!jsonContent.trim().length) {
      setErrorMessage("Missing MCP JSON configuration");
      return;
    }
    try {
      const json = JSON.parse(jsonContent);

      const parseResult = mcpJsonSchema.safeParse(json);

      if (!parseResult.success) {
        setErrorMessage(z.prettifyError(parseResult.error));
        return;
      }

      const parsed = parseResult.data;

      const keys = Object.keys(parsed);
      if (keys.length !== 1) {
        setErrorMessage("JSON must contain exactly one server definition.");
        return;
      }
      if (keys[0] !== initialData?.name) {
        setErrorMessage(
          `Server name cannot be changed. It must remain "${initialData?.name}".`,
        );
        return;
      }

      const name = keys[0];

      if (
        Object.keys(parsed).length !== 1 ||
        typeof parsed[name] !== "object" ||
        !parsed[name] ||
        Array.isArray(parsed[name])
      ) {
        console.warn("Invalid MCP JSON format:", parsed);
        setErrorMessage("JSON must contain exactly one server definition.");
        return;
      }

      const payload = {
        ...parsed[name],
        icon: icon || DEFAULT_SERVER_ICON,
        name,
      };

      const rawServer = parseServerPayload(payload);

      if (!rawServer.success) {
        setErrorMessage(z.prettifyError(rawServer.error));
        return;
      }

      const { name: serverName, ...rawServerData } = rawServer.data;

      const type = "url" in rawServerData ? inferServerTypeFromUrl(rawServerData.url) : undefined;
      if (!type) {
        setErrorMessage("Could not infer server type, please provide explicit type");
        return;
      }

      editServer(
        {
          name: initialData.name,
          payload:
            "url" in rawServerData
              ? {
                  type,
                  ...rawServerData,
                }
              : { ...rawServerData, type: "stdio" as const },
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
    } catch (e) {
      setErrorMessage("Invalid JSON format");
    }
  };

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open || handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <div className="space-y-4">
          <DialogHeader className="border-b border-[var(--color-border-primary)] p-6">
            <DialogTitle className="flex items-center gap-2 text-2xl text-[var(--color-text-primary)]">
              <FileText className="w-6 h-6 text-[var(--color-fg-interactive)]" />
              Edit Server <i>{initialData?.name}</i>
            </DialogTitle>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Edit MCP server configuration.{" "}
              <b>Server name cannot be changed.</b>
            </p>
          </DialogHeader>
          <Label className="inline-flex flex-0 flex-col items-start gap-4">
            Choose Emoji:
            <Popover open={isIconPickerOpen} onOpenChange={setIconPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="inline-block text-2xl h-12 w-12 p-3  rounded-xl leading-none"
                >
                  {icon || DEFAULT_SERVER_ICON}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start">
                <EmojiPicker
                  onEmojiClick={(event) => {
                    setIcon(event.emoji);
                    setIconPickerOpen(false);
                  }}
                  previewConfig={{
                    showPreview: false,
                  }}
                  theme={
                    colorScheme === "dark"
                      ? EmojiPickerTheme.DARK
                      : EmojiPickerTheme.LIGHT
                  }
                  autoFocusSearch
                  lazyLoadEmojis
                  skinTonesDisabled
                  open
                />
              </PopoverContent>
            </Popover>
          </Label>
          <McpJsonForm
            colorScheme={colorScheme}
            errorMessage={errorMessage}
            onChange={handleJsonChange}
            schema={z.toJSONSchema(mcpJsonSchema)}
            value={jsonContent}
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
              disabled={isPending || !isDirty}
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
