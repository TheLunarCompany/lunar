import { DEFAULT_SERVER_ICON } from "@/components/dashboard/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useAddMcpServer } from "@/data/mcp-server";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { cn } from "@/lib/utils";
import { useSocketStore } from "@/store";
import {
  createTargetServerRequestSchema,
  TargetServer,
} from "@mcpx/shared-model";
import MonacoEditor, { Theme as MonacoEditorTheme } from "@monaco-editor/react";
import { AxiosError } from "axios";
import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { AlertCircle } from "lucide-react";
import { editor } from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod/v4";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

const MCP_JSON_FILE_PATH = "mcp.json";
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

const isValidJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
};

const serverNameSchema = z.string().min(1, "Server name is required");

const localServerSchema = z.strictObject({
  type: z.literal("stdio").default("stdio").optional(),
  command: z.string().min(1, "Command is required"),
  args: z.array(z.string()).default([]).optional(),
  env: z.record(z.string().min(1), z.string()).default({}).optional(),
});

const remoteServerSchema = z.strictObject({
  type: z.enum(["sse", "streamable-http"]).default("sse").optional(),
  url: z.url().and(
    z
      .string()
      .min(1, "URL is required")
      // Very simplified URL validation regex
      .regex(
        /^https?:\/\/[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_\-]+)*(\/[a-zA-Z0-9_\-]*)*$/,
      ),
  ),
});

const mcpServerSchema = z.union([localServerSchema, remoteServerSchema]);

const mcpJsonSchema = z.record(
  z.string().min(1, { error: "Server name must not be empty" }),
  mcpServerSchema,
);

// The payload schemas are not strict, so they are used mainly to strip irrelevant properties,
// and do transforms that are not possible with the JSON Schemas, but not for validation.
const localServerPayloadSchema = z
  .object({
    icon: z.string(),
    name: z.string(),
    type: z.literal("stdio").optional(),
    command: z.string(),
    args: z.array(z.string()).default([]).optional(),
    env: z.record(z.string(), z.string()).default({}).optional(),
  })
  .transform((server) => ({
    ...server,
    type: server.type || "stdio",
    args: server.args?.join(" ") || "",
    env: JSON.stringify(server.env || {}),
  }));
const remoteServerPayloadSchema = z.object({
  icon: z.string(),
  name: z.string(),
  type: z.enum(["sse", "streamable-http"]).default("sse"),
  url: z.string(),
});

const parseServerPayload = (server: z.input<typeof mcpServerSchema>) => {
  if (server.type === "stdio") {
    return localServerPayloadSchema.safeParse(server);
  }
  return remoteServerPayloadSchema.safeParse(server);
};

const rawServerSchema = z
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
        : !server.type || server.type === "stdio"
          ? ""
          : undefined,
    env:
      "env" in server
        ? server.env
          ? JSON.stringify(server.env)
          : ""
        : undefined,
  }));

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
  const [isFocused, setIsFocused] = useState(false);
  const isDirty = useMemo(
    () =>
      jsonContent.replaceAll(/\s/g, "").trim() !==
      DEFAULT_SERVER_CONFIGURATION_JSON.replaceAll(/\s/g, "").trim(),
    [jsonContent],
  );
  const colorScheme = useColorScheme();
  const emojiPickerTheme = useMemo<EmojiPickerTheme>(
    () =>
      colorScheme === "dark" ? EmojiPickerTheme.DARK : EmojiPickerTheme.LIGHT,
    [colorScheme],
  );
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

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
    if (!payload) {
      showError(`Server with name "${name}" not found in JSON.`);
      return;
    }

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
        payload: rawServer.data,
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
            <div className="w-full flex flex-col gap-4">
              <Label className="inline-flex flex-0 flex-col items-start mb-0">
                JSON
                <input
                  className="absolute w-[0px] h-[0px] opacity-0"
                  onFocus={() => editorRef.current?.focus()}
                  readOnly
                />
              </Label>
              <div
                className={cn(
                  "flex-1 gap-4 items-start border border-[var(--color-border-primary)] p-1 rounded-lg",
                  {
                    "opacity-50": !isDirty && !isFocused,
                  },
                )}
              >
                <MonacoEditor
                  height="304px"
                  width={"100%"}
                  defaultLanguage="json"
                  language="json"
                  value={jsonContent}
                  onChange={handleJsonChange}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    const schema = z.toJSONSchema(mcpJsonSchema);
                    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                      validate: true,
                      schemas: [
                        {
                          uri: "https://docs.lunar.dev/mcpx/mcp.json",
                          fileMatch: [MCP_JSON_FILE_PATH],
                          schema,
                        },
                      ],
                      schemaValidation: "error",
                    });
                    editor.onDidFocusEditorText(() => {
                      setIsFocused(true);
                    });
                    editor.onDidBlurEditorText(() => {
                      setIsFocused(false);
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
                    scrollBeyondLastLine: false,
                    suggest: {
                      preview: true,
                    },
                  }}
                  theme={monacoEditorTheme}
                  path={MCP_JSON_FILE_PATH}
                />
              </div>
            </div>
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

          {errorMessage && (
            <div className="mb-3 p-2 bg-[var(--color-bg-danger)] border border-[var(--color-border-danger)] rounded-md">
              <p className="inline-flex items-center gap-1 px-2 py-0.5 font-medium text-sm text-[var(--color-fg-danger)]">
                <AlertCircle className="w-3 h-3" />
                {errorMessage}
              </p>
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
