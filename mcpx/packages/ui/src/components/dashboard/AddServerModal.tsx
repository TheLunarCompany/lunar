import { DEFAULT_SERVER_ICON } from "@/components/dashboard/constants";
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
import { useAddMcpServer } from "@/data/mcp-server";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSocketStore } from "@/store";
import {
  inferServerTypeFromUrl,
  isValidJson,
  mcpJsonSchema,
  parseServerPayload,
  serverNameSchema,
} from "@/utils/mcpJson";
import { TargetServerNew } from "@mcpx/shared-model";
import { AxiosError } from "axios";
import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { McpJsonForm } from "./McpJsonForm";

const DEFAULT_SERVER_NAME = "my-server";
const DEFAULT_SERVER_COMMAND = "my-command";
const DEFAULT_SERVER_ARGS = "--arg-key arg-value";
const DEFAULT_ENVIRONMENT_VARIABLES = {
  MY_ENV_VAR: "my-env-value",
} as const;
const DEFAULT_SERVER_CONFIGURATION_JSON = JSON.stringify(
  {
    [DEFAULT_SERVER_NAME]: {
      command: DEFAULT_SERVER_COMMAND,
      args: DEFAULT_SERVER_ARGS.split(" "),
      env: DEFAULT_ENVIRONMENT_VARIABLES,
    },
  },
  null,
  2,
);

const getServerExistsError = (name: string) =>
  `Server with name "${name}" already exists. Please choose a different name.`;

const getDefaultServerNameError = () =>
  `Server name cannot be "${DEFAULT_SERVER_NAME}". Please choose a different name.`;

const getDefaultCommandError = () =>
  `Command cannot be "${DEFAULT_SERVER_COMMAND}". Please provide a valid command.`;

export const AddServerModal = ({
  onClose,
  onServerAdded,
}: {
  onClose: () => void;
  onServerAdded?: (server: any) => void;
}) => {
  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));
  const { mutate: addServer, isPending, error } = useAddMcpServer();

  const [icon, setIcon] = useState(DEFAULT_SERVER_ICON);
  const [name, setName] = useState(DEFAULT_SERVER_NAME);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [jsonContent, setJsonContent] = useState(
    DEFAULT_SERVER_CONFIGURATION_JSON,
  );
  const colorScheme = useColorScheme();
  const emojiPickerTheme = useMemo<EmojiPickerTheme>(
    () =>
      colorScheme === "dark" ? EmojiPickerTheme.DARK : EmojiPickerTheme.LIGHT,
    [colorScheme],
  );
  const isDirty = useMemo(
    () =>
      jsonContent.replaceAll(/\s/g, "").trim() !==
      DEFAULT_SERVER_CONFIGURATION_JSON.replaceAll(/\s/g, "").trim(),
    [jsonContent],
  );

  const { toast } = useToast();

  const showError = (message: string) => {
    setErrorMessage(message);
  };

  useEffect(() => {
    if (!error) return;

    const message =
      error instanceof AxiosError && error.response?.data?.msg
        ? error.response.data.msg
        : "Failed to add server. Please try again.";

    showError(message);
  }, [error]);

  const handleAddServer = () => {
    if (!jsonContent.trim().length) {
      console.warn("Missing MCP JSON configuration");
      showError("Missing MCP JSON configuration");
      return;
    }

    if (!isValidJson(jsonContent)) {
      console.warn("Invalid JSON format");
      showError("Invalid JSON format");
      return;
    }

    const parsedServerName = serverNameSchema.safeParse(name);
    if (!parsedServerName.success) {
      const flattened = z.flattenError(parsedServerName.error);
      showError(flattened.formErrors.join(", "));
      return;
    }

    const json = JSON.parse(jsonContent);

    const parseResult = mcpJsonSchema.safeParse(json);

    if (!parseResult.success) {
      showError(z.prettifyError(parseResult.error));
      return;
    }

    const parsed = parseResult.data;

    if (
      Object.keys(parsed).length !== 1 ||
      typeof parsed[name] !== "object" ||
      !parsed[name] ||
      Array.isArray(parsed[name])
    ) {
      console.warn("Invalid MCP JSON format:", parsed);
      showError("JSON must contain exactly one server definition.");
      return;
    }

    const payload = {
      ...parsed[name],
      icon,
      name,
    };

    const existingServer = systemState?.targetServers.find(
      (server) => server.name === name,
    );

    if (existingServer) {
      showError(getServerExistsError(name));
      return;
    }

    if (name === DEFAULT_SERVER_NAME) {
      showError(getDefaultServerNameError());
      return;
    }

    if (
      !payload.type ||
      (payload.type === "stdio" && payload.command === DEFAULT_SERVER_COMMAND)
    ) {
      showError(getDefaultCommandError());
      return;
    }

    const rawServer = parseServerPayload(payload);

    if (!rawServer.success) {
      showError(z.prettifyError(rawServer.error));
      return;
    }

    addServer(
      {
        payload:
          "url" in rawServer.data
            ? {
                ...rawServer.data,
                type: inferServerTypeFromUrl(rawServer.data.url),
              }
            : { ...rawServer.data, type: "stdio" as const },
      },
      {
        onSuccess: (server: TargetServerNew) => {
          toast({
            description: `Server "${server.name}" was added successfully.`,
            title: "Server Added",
          });
          onServerAdded?.({
            server: { ...payload, ...server },
          });
        },
        onError: (error) => {
          console.warn("Error adding server:", error);
        },
      },
    );
  };

  const handleJsonChange = useCallback(
    (value: string) => {
      setJsonContent(() => value);
      if (errorMessage.length > 0) {
        showError("");
      }
      if (!value || value === DEFAULT_SERVER_CONFIGURATION_JSON) return;
      try {
        const parsed = JSON.parse(value);
        const keys = Object.keys(parsed);
        const parsedName = serverNameSchema.parse(keys[0]);
        setName(parsedName);
      } catch (e) {
        console.warn("Invalid JSON format:", e);
        setName("");
      }
    },
    [errorMessage],
  );

  const handleClose = () => {
    if (
      !isDirty ||
      confirm("Close Configuration? Changes you made have not been saved")
    ) {
      onClose?.();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => open || handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <div className="space-y-4">
          <DialogHeader className="border-b border-[var(--color-border-primary)] pb-6">
            <DialogTitle className="flex items-center gap-2 text-lg text-[var(--color-text-primary)]">
              Add MCP Server
            </DialogTitle>
            <p className="mt-2 text-sm">
              Add the server to your configuration by pasting your server's JSON
              configuration below.
            </p>
          </DialogHeader>

          <div className="flex flex-col flex-1 gap-8 items-start">
            <Label className="inline-flex flex-0 flex-col items-start gap-4">
              Choose Emoji:
              <Popover open={isIconPickerOpen} onOpenChange={setIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="inline-block text-2xl h-12 w-12 p-3 bg-accent rounded-xl leading-none"
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
                    theme={emojiPickerTheme}
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
              placeholder={DEFAULT_SERVER_CONFIGURATION_JSON}
              schema={z.toJSONSchema(mcpJsonSchema)}
              value={jsonContent}
            />
          </div>
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
          <DialogFooter className="gap-3 py-6 border-t border-[var(--color-border-primary)]">
            {handleClose && (
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
                type="button"
              >
                Cancel
              </Button>
            )}
            <Button
              disabled={isPending || !isDirty}
              className="bg-[var(--color-fg-interactive)] hover:enabled:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
              onClick={handleAddServer}
            >
              {isPending ? (
                <>
                  Adding...
                  <Spinner />
                </>
              ) : (
                "Add Server"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
