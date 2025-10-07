import { DEFAULT_SERVER_ICON } from "@/components/dashboard/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  validateAndProcessServer,
  validateServerName,
  validateServerCommand,
} from "@/utils/server-helpers";
import { serverNameSchema, mcpJsonSchema } from "@/utils/mcpJson";
import { AxiosError } from "axios";
import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { McpJsonForm } from "./McpJsonForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { McpServerExamples } from "./McpServerExamples";
import { editor } from "monaco-editor";

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
}: {
  onClose: () => void;
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
  const [selectedExample, setSelectedExample] = useState<string>("memory");
  const [activeTab, setActiveTab] = useState<string>("json");
  const colorScheme = useColorScheme();
  const emojiPickerTheme = useMemo<EmojiPickerTheme>(
    () => EmojiPickerTheme.LIGHT,
    [colorScheme],
  );
  const isDirty = useMemo(
    () =>
      jsonContent.replaceAll(/\s/g, "").trim() !==
      DEFAULT_SERVER_CONFIGURATION_JSON.replaceAll(/\s/g, "").trim(),
    [jsonContent],
  );
  const [isValid, setIsValid] = useState(true);
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
    // Use the shared validation and processing logic
    const result = validateAndProcessServer({
      jsonContent,
      icon,
      existingServers: systemState?.targetServers || [],
      isEdit: false
    });

    if (result.success === false) {
      showError(result.error || "Failed to add server. Please try again.");
      return;
    }

    // Additional validations specific to add operation
    const nameError = validateServerName(name);
    if (nameError) {
      showError(nameError);
      return;
    }

    const commandError = validateServerCommand(result.payload);
    if (commandError) {
      showError(commandError);
      return;
    }

    // Update the JSON content to include the type
    if (result.updatedJsonContent) {
      setJsonContent(result.updatedJsonContent);
    }

    console.log("Sending server payload:", result.payload);

    addServer(
      {
        payload: result.payload,
      },
      {
        onSuccess: (server: { name: string }) => {
          toast({
            description: `Server "${server.name}" was added successfully.`,
            title: "Server Added",
            duration: 3000, 
            isClosable: true,
          });
          // Close the modal - the system state will be updated via socket
          onClose();
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

  const handleUseExample = (config: any, serverName: string) => {
    setJsonContent(JSON.stringify(config, null, 2));
    setName(serverName);
    setActiveTab("json");
    toast({
      title: "Example loaded!",
      description: `Server configuration has been loaded. Remember to update any API keys and customize as needed.`,
    });
  };

  const handleValidate = useCallback(
    (markers: editor.IMarker[]) => {
      setIsValid(markers.length === 0);
    },
    [],
  );

  return (
    <Dialog open onOpenChange={(open) => open || handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <DialogHeader className="border-b border-[var(--color-border-primary)] pb-6 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg text-[var(--color-text-primary)]">
            Add MCP Server
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            Add the server to your configuration by pasting your server's JSON
            configuration below.
          </DialogDescription>
          <Label className="inline-flex flex-0 flex-row items-center justify-end gap-4">
            <Popover open={isIconPickerOpen} onOpenChange={setIconPickerOpen}>
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
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="json">JSON Config</TabsTrigger>
                <TabsTrigger value="examples">Examples</TabsTrigger>
              </TabsList>

              <TabsContent value="json" className="mt-4">
                <McpJsonForm
                  colorScheme={colorScheme}
                  errorMessage={errorMessage}
                  onValidate={handleValidate}
                  onChange={handleJsonChange}
                  placeholder={DEFAULT_SERVER_CONFIGURATION_JSON}
                  schema={z.toJSONSchema(mcpJsonSchema)}
                  value={jsonContent}
                />
              </TabsContent>

              <TabsContent value="examples" className="mt-4">
                <McpServerExamples
                  selectedExample={selectedExample}
                  onExampleChange={setSelectedExample}
                  onUseExample={handleUseExample}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {isPending && (
          <div className="px-6 flex-shrink-0">
            <div className="space-y-2">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-container-secondary)] animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--color-fg-interactive)] to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-fg-interactive)] via-transparent to-[var(--color-fg-interactive)] animate-[shimmer_1.5s_ease-in-out_infinite_reverse]" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-3 pt-6 pb-0 border-t border-[var(--color-border-primary)] flex-shrink-0">
          {handleClose && (
            <Button onClick={handleClose} type="button">
              Cancel
            </Button>
          )}
          <Button
            disabled={isPending || !isDirty || activeTab !== "json" || !isValid}
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
      </DialogContent>
    </Dialog>
  );
};
