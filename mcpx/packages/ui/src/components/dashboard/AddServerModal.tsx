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
  createTargetServerRequestSchema,
  TargetServer,
} from "@mcpx/shared-model";
import MonacoEditor, { Theme as MonacoEditorTheme } from "@monaco-editor/react";
import { AxiosError } from "axios";
import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toJSONSchema, z } from "zod/v4";

const MCP_DOT_JSON = "mcp.json";
const INITIAL_SERVERNAME = "my-server";
const INITIAL_COMMAND = "my-command";
const INITIAL_ARGS = "--arg-key arg-value";
const INITIAL_ENV = {
  MY_ENV_VAR: "my-env-value",
} as const;
const INITIAL_VALUES_JSON = JSON.stringify(
  {
    [INITIAL_SERVERNAME]: {
      command: INITIAL_COMMAND,
      args: INITIAL_ARGS.split(" "),
      env: INITIAL_ENV,
    },
  },
  null,
  2,
);

const getServerExistsError = (name: string) =>
  `Server with name "${name}" already exists. Please choose a different name.`;

const getInitialServerNameError = () =>
  `Server name cannot be "${INITIAL_SERVERNAME}". Please choose a different name.`;

const getInitialCommandError = () =>
  `Command cannot be "${INITIAL_COMMAND}". Please provide a valid command.`;

const isValidJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
};

const serverNameSchema = z.string().min(1, "Server name is required");

const localServerSchema = z.object({
  type: z.literal("stdio").default("stdio").optional(),
  command: z.string().min(1, "Command is required"),
  args: z.array(z.string()).optional(),
  env: z.record(z.string().min(1), z.string()).optional(),
});

const remoteServerSchema = z.object({
  type: z.enum(["sse", "streamable-http"]).default("sse").optional(),
  url: z.url(),
});

const mcpServerSchema = z.union([localServerSchema, remoteServerSchema]);

const mcpJsonSchema = z.record(z.string().min(1), mcpServerSchema);

const toRawServerSchema = (payload: z.infer<typeof mcpServerSchema>) =>
  z
    .intersection(
      mcpServerSchema,
      z.object({
        name: serverNameSchema,
        icon: z.string().optional(),
      }),
    )
    .transform((server) => ({
      ...server,
      type: server.type || "stdio",
      args:
        "args" in server
          ? Array.isArray(server.args)
            ? server.args.join(" ")
            : ""
          : undefined,
      env:
        "env" in server
          ? server.env
            ? JSON.stringify(server.env)
            : ""
          : undefined,
    }))
    .parse(payload);

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
  const [name, setName] = useState(INITIAL_SERVERNAME);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [jsonContent, setJsonContent] = useState(INITIAL_VALUES_JSON);
  const isDirty = useMemo(
    () =>
      jsonContent.replaceAll(/\s/g, "").trim() !==
      INITIAL_VALUES_JSON.replaceAll(/\s/g, "").trim(),
    [jsonContent],
  );
  const colorScheme = useColorScheme();
  const emojiPickerTheme = useMemo<EmojiPickerTheme>(
    () =>
      colorScheme === "dark" ? EmojiPickerTheme.DARK : EmojiPickerTheme.LIGHT,
    [colorScheme],
  );

  const { toast } = useToast();

  const showErrorToast = (message: string) => {
    toast({
      description: message,
      title: "Error",
      variant: "destructive",
    });
  };

  useEffect(() => {
    if (!error) return;

    const message =
      error instanceof AxiosError && error.response?.data?.msg
        ? error.response.data.msg
        : "Failed to add server. Please try again.";

    showErrorToast(message);
  }, [error, toast]);

  const handleAddOrEditServer = () => {
    if (!isJsonValid || !jsonContent.length) {
      console.warn("Invalid JSON format");
      showErrorToast("Invalid MCP JSON format");
      return;
    }

    const parseResult = mcpJsonSchema.safeParse(JSON.parse(jsonContent));

    if (!parseResult.success) {
      showErrorToast(
        `Invalid MCP JSON format: ${z.treeifyError(parseResult.error)}`,
      );
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
      showErrorToast("JSON must contain exactly one server definition.");
      return;
    }

    const payload = {
      ...parsed[name],
      icon,
      name,
    };
    if (!payload) {
      showErrorToast(`Server with name "${name}" not found in JSON.`);
      return;
    }

    const existingServer = systemState?.targetServers.find(
      (server) => server.name === name,
    );

    if (existingServer) {
      showErrorToast(getServerExistsError(name));
      return;
    }

    if (name === INITIAL_SERVERNAME) {
      showErrorToast(getInitialServerNameError());
      return;
    }

    if (payload.type === "stdio" && payload.command === INITIAL_COMMAND) {
      showErrorToast(getInitialCommandError());
      return;
    }

    addServer(
      {
        payload: toRawServerSchema(payload) as z.infer<
          typeof createTargetServerRequestSchema
        >,
      },
      {
        onSuccess: (server: TargetServer) => {
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

  const monacoEditorTheme = useMemo<MonacoEditorTheme>(() => {
    return colorScheme === "dark" ? "vs-dark" : "light";
  }, [colorScheme]);

  const handleJsonChange = (value: string | undefined = "") => {
    setJsonContent(value);

    if (!value.length || !isValidJson(value)) {
      setIsJsonValid(false);
      return;
    }

    setIsJsonValid(true);

    if (!value || value === INITIAL_VALUES_JSON) return;

    try {
      const parsed = JSON.parse(value);
      const keys = Object.keys(parsed);
      const parsedName = serverNameSchema.parse(keys[0]);
      setName(parsedName);
    } catch (e) {
      console.error("Invalid JSON format:", e);
      setName("");
      setIsJsonValid(false);
    }
  };

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
          <DialogHeader className="border-b border-[var(--color-border-primary)] p-6">
            <DialogTitle className="flex items-center gap-2 text-2xl text-[var(--color-text-primary)]">
              <FileText className="w-6 h-6 text-[var(--color-fg-interactive)]" />
              Add MCP Server
            </DialogTitle>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Add a new MCP server to your configuration.
            </p>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Fill in the details below to connect the server and manage its
              settings.
            </p>
          </DialogHeader>

          <div className="flex flex-col flex-1 overflow-hidden p-6 gap-4 items-start">
            <Label className="inline-flex flex-0 items-center gap-2">
              Icon:
              <Popover open={isIconPickerOpen} onOpenChange={setIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="inline-block text-3xl py-0 px-2"
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
            <MonacoEditor
              height="304px"
              width={"100%"}
              defaultLanguage="json"
              language="json"
              value={jsonContent}
              onChange={handleJsonChange}
              onMount={(_, monaco) => {
                monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                  validate: true,
                  schemas: [
                    {
                      uri: "https://docs.lunar.dev/mcpx/mcp.json",
                      fileMatch: [MCP_DOT_JSON],
                      schema: toJSONSchema(mcpJsonSchema),
                    },
                  ],
                });
              }}
              options={{
                language: "json",
                autoClosingBrackets: "always",
                autoClosingQuotes: "always",
                autoIndent: "full",
                minimap: { enabled: false },
                formatOnPaste: true,
                formatOnType: true,
                quickSuggestions: {
                  comments: false,
                  other: true,
                  strings: true,
                },
              }}
              theme={monacoEditorTheme}
              path={MCP_DOT_JSON}
            />
          </div>

          <DialogFooter className="gap-3 p-6 border-t border-[var(--color-border-primary)]">
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
              disabled={isPending || !isJsonValid}
              className="bg-[var(--color-fg-interactive)] hover:enabled:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
              onClick={handleAddOrEditServer}
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
