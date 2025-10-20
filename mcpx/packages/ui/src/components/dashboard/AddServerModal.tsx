import {
  getMcpColorByName,
  MCP_SERVER_EXAMPLES,
} from "@/components/dashboard/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
import { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
import { McpJsonForm } from "./McpJsonForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { editor } from "monaco-editor";
import { Input } from "../ui/input";
import { ServerCard } from "./ServerCard";
import { isIconExists, useDomainIcon } from "@/hooks/useDomainIcon";

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

export const AddServerModal = ({ onClose }: { onClose: () => void }) => {
  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));
  const { mutate: addServer, isPending, error } = useAddMcpServer();

  const [name, setName] = useState(DEFAULT_SERVER_NAME);

  const [search, setSearch] = useState("");

  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [jsonContent, setJsonContent] = useState(
    DEFAULT_SERVER_CONFIGURATION_JSON,
  );
  const [selectedExample, setSelectedExample] = useState<string>("memory");
  const [activeTab, setActiveTab] = useState<string>("all");
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

  function getServerStatus(
    name: string,
  ): "active" | "pending" | "error" | undefined {
    return systemState?.targetServers_new.find(
      (server) => server.name.toLowerCase() === name.toLowerCase(),
    )?.state.type;
  }

  const handleAddServer = (name: string, jsonContent: string) => {
    const result = validateAndProcessServer({
      jsonContent,
      icon: isIconExists(name) ? undefined : getMcpColorByName(name),
      existingServers: systemState?.targetServers || [],
      isEdit: false,
    });

    if (result.success === false) {
      showError(result.error || "Failed to add server. Please try again.");
      return;
    }

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

  const handleUseExample = (
    config: any,
    serverName: string,
    withEnvs?: boolean,
  ) => {
    const newJsonContent = JSON.stringify(config, null, 2);
    setJsonContent(newJsonContent);
    setName(serverName);

    if (!withEnvs) {
      handleAddServer(serverName, newJsonContent);
      return;
    }
    setActiveTab("custom");
  };

  const handleValidate = useCallback((markers: editor.IMarker[]) => {
    setIsValid(markers.length === 0);
  }, []);

  return (
    <Dialog open onOpenChange={(open) => open || handleClose()}>
      <DialogContent className="max-w-[1560px] max-h-[90vh+40px] flex flex-col bg-white border border-[var(--color-border-primary)] rounded-lg">
        <div className="text-2xl font-semibold">Add Server</div>
        <hr />
        <div className="flex flex-col ">
          <div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList variant="inline">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
              {activeTab === "all" && (
                <div className="my-4">
                  <div className="my-4 text-sm">
                    Select server to add to your configuration
                  </div>
                  <div>
                    <Input
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search..."
                    />
                  </div>
                </div>
              )}

              {activeTab === "custom" && (
                <div className="my-4 text-sm">
                  Add the server to your configuration by pasting your server's
                  JSON configuration below.
                </div>
              )}
              <TabsContent value="all">
                <div className="flex gap-4 bg-white flex-wrap overflow-y-auto min-h-[calc(70vh-40px)] max-h-[calc(70vh-40px)]">
                  {MCP_SERVER_EXAMPLES.filter((example) =>
                    example.label.toLowerCase().includes(search.toLowerCase()),
                  ).map((example) => (
                    <ServerCard
                      key={example.value}
                      server={example}
                      status={getServerStatus(example.value)}
                      className="w-[calc(25%-1rem)] max-h-[260px]"
                      onAddServer={handleUseExample}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="custom">
                <McpJsonForm
                  className="h-[calc(70vh-30px)]"
                  colorScheme={colorScheme}
                  errorMessage={errorMessage}
                  onValidate={handleValidate}
                  onChange={handleJsonChange}
                  placeholder={DEFAULT_SERVER_CONFIGURATION_JSON}
                  schema={z.toJSONSchema(mcpJsonSchema)}
                  value={jsonContent}
                />
              </TabsContent>
            </Tabs>
          </div>
          <div></div>
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

        {activeTab === "custom" && (
          <div className="w-full flex justify-between">
            {handleClose && (
              <Button
                onClick={handleClose}
                className="text-component-primary"
                variant="ghost"
                type="button"
              >
                Cancel
              </Button>
            )}
            <Button
              disabled={
                isPending || !isDirty || activeTab !== "custom" || !isValid
              }
              onClick={() => handleAddServer(name, jsonContent)}
            >
              {isPending ? (
                <>
                  Adding...
                  <Spinner />
                </>
              ) : (
                "Add"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
