import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAddMcpServer } from "@/data/mcp-server";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSocketStore } from "@/store";
import { RawCreateTargetServerRequest } from "@mcpx/shared-model";
import MonacoEditor, { Theme as MonacoEditorTheme } from "@monaco-editor/react";
import { AxiosError } from "axios";
import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { AlertCircle, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { DEFAULT_SERVER_ICON } from "./constants";

const TabName = {
  Json: "json",
  Form: "form",
} as const;

type Tab = (typeof TabName)[keyof typeof TabName];

const INITIAL_SERVER_NAME = "my-server";
const INITIAL_COMMAND = "my-command";
const INITIAL_ARGS = "--arg-key arg-value";
const INITIAL_ENV = {
  MY_ENV_VAR: "my-env-value",
} as const;
const JSON_PLACEHOLDER = JSON.stringify(
  {
    [INITIAL_SERVER_NAME]: {
      command: INITIAL_COMMAND,
      args: INITIAL_ARGS.split(" "),
      env: INITIAL_ENV,
    },
  },
  null,
  2,
);

const isValidJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
};

export const AddServerModal = ({
  isOpen,
  onClose,
  onServerAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  onServerAdded: (server: any) => void;
}) => {
  const { systemState } = useSocketStore((s) => ({
    systemState: s.systemState,
  }));
  const { mutate: addServer, isPending, error } = useAddMcpServer();

  const {
    clearErrors,
    register,
    handleSubmit,
    formState: { errors, submitCount },
    getValues,
    setValue,
    trigger,
    watch,
  } = useForm<RawCreateTargetServerRequest>({
    defaultValues: {
      icon: DEFAULT_SERVER_ICON,
      name: INITIAL_SERVER_NAME,
      command: INITIAL_COMMAND,
      args: INITIAL_ARGS,
      env: JSON.stringify(INITIAL_ENV, null, 2),
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const icon = watch("icon");

  const [currentTab, setCurrentTab] = useState<Tab>(TabName.Json);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [showInvalidJsonAlert, setShowInvalidJsonAlert] = useState(false);
  const [jsonContent, setJsonContent] = useState(JSON_PLACEHOLDER);
  const [validationErrorMessage, setValidationErrorMessage] = useState("");

  const colorScheme = useColorScheme();
  const monacoEditorTheme = useMemo<MonacoEditorTheme>(() => {
    return colorScheme === "dark" ? "vs-dark" : "light";
  }, [colorScheme]);
  const emojiPickerTheme = useMemo<EmojiPickerTheme>(() => {
    return colorScheme === "dark"
      ? EmojiPickerTheme.DARK
      : EmojiPickerTheme.LIGHT;
  }, [colorScheme]);

  const serverErrorMessage = useMemo(() => {
    if (!error) return undefined;

    if (error instanceof AxiosError) {
      return (
        error.response?.data.msg || "Failed to add server. Please try again."
      );
    }

    return error.message || "Failed to add server. Please try again.";
  }, [error]);

  const fieldErrors = Object.entries(errors)
    .map(([key, value]) => {
      if (value?.message) {
        return `${key} - ${value.message}`;
      }
      if (value?.type === "required") {
        return `${key} is required`;
      }
    })
    .filter(Boolean);

  const handleAddServer = handleSubmit((inputs) => {
    if (!isJsonValid) {
      setShowInvalidJsonAlert(true);
      console.error("Invalid JSON format");
      return;
    }

    const { icon, args, command, env, name } = inputs;

    const existingServer = systemState?.targetServers.find(
      (server) => server.name === name,
    );
    if (existingServer) {
      setValidationErrorMessage(
        `Server with name "${name}" already exists. Please choose a different name.`,
      );
      return;
    }

    addServer(
      { payload: { args, command, env, icon, name } },
      {
        onSuccess: ({ server }) => {
          onServerAdded({
            server: { args, command, env, icon, name, ...server },
          });
        },
        onError: (error) => {
          console.error("Error adding server:", error);
        },
      },
    );
  });

  const handleJsonChange = (value?: string) => {
    if (!value || !isValidJson(value)) {
      setIsJsonValid(false);
      return;
    }

    setShowInvalidJsonAlert(false);

    if (value.trim() === "") {
      setJsonContent("");
      setValue("name", "");
      setValue("command", "");
      setValue("args", "");
      setValue("env", "{}");
      return;
    }

    try {
      const parsed = JSON.parse(value);
      setValue("name", Object.keys(parsed)[0] || "");
      setValue("command", parsed[Object.keys(parsed)[0]].command || "");
      setValue("args", parsed[Object.keys(parsed)[0]].args.join(" ") || []);
      setValue(
        "env",
        JSON.stringify(parsed[Object.keys(parsed)[0]].env || {}, null, 2),
      );
      setJsonContent(value);
      setIsJsonValid(true);
    } catch (e) {
      console.error("Invalid JSON format:", e);
      setValue("name", "");
      setValue("command", "");
      setValue("args", "");
      setValue("env", "{}");
    }
  };

  const handleTabsChange = async (value: string) => {
    if (!isJsonValid && value === TabName.Form) {
      // If JSON is invalid, prevent switching to Form tab
      setShowInvalidJsonAlert(true);
      console.error("Cannot switch to Form tab, JSON is invalid");
      return;
    }

    // Trigger validation to ensure form values are up-to-date
    const isEnvValid = await trigger("env");

    if (!isEnvValid) {
      return;
    }

    if (value === TabName.Json) {
      // When switching to JSON tab, convert form values to JSON
      const { args, command, name, env } = getValues();
      try {
        let parsedEnv;
        try {
          parsedEnv = JSON.parse(env || "{}");
        } catch {
          parsedEnv = {};
        }
        const json = {
          [name]: {
            command,
            args: args
              .split(" ")
              .map((arg) => arg.trim())
              .filter(Boolean),
            env: parsedEnv,
          },
        };
        setJsonContent(JSON.stringify(json, null, 2));
        setIsJsonValid(true);
      } catch (e) {
        console.error("Error converting form values to JSON:", e);
        setJsonContent("");
        setIsJsonValid(false);
      }
    } else if (value === TabName.Form) {
      // When switching to Form tab, parse the current JSON content
      try {
        const parsed = JSON.parse(jsonContent);
        setValue("name", Object.keys(parsed)[0] || "");
        setValue("command", parsed[Object.keys(parsed)[0]].command || "");
        setValue("args", parsed[Object.keys(parsed)[0]].args.join(" ") || []);
        setValue(
          "env",
          JSON.stringify(parsed[Object.keys(parsed)[0]].env || {}, null, 2),
        );
        setIsJsonValid(true);
      } catch (e) {
        console.error("Error parsing JSON content:", e);
        setValue("name", "");
        setValue("command", "");
        setValue("args", "");
        setValue("env", "{}");
        setIsJsonValid(false);
      }
    }

    clearErrors();

    setShowInvalidJsonAlert(false);

    setCurrentTab(value as Tab);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose || (() => {})}>
      <Tabs
        activationMode="manual"
        onValueChange={handleTabsChange}
        value={currentTab}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
          <form className="space-y-4" onSubmit={handleAddServer}>
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
              {showInvalidJsonAlert && (
                <Alert
                  variant="destructive"
                  className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Invalid JSON format</AlertDescription>
                  </div>
                </Alert>
              )}

              {serverErrorMessage && (
                <Alert
                  variant="destructive"
                  className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{serverErrorMessage}</AlertDescription>
                  </div>
                </Alert>
              )}

              {validationErrorMessage && (
                <Alert
                  variant="destructive"
                  className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {validationErrorMessage}
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {fieldErrors.length > 0 && (
                <Alert
                  variant="destructive"
                  className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
                >
                  {fieldErrors.map((fieldError, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{fieldError}</AlertDescription>
                    </div>
                  ))}
                </Alert>
              )}

              <Label className="inline-flex flex-0 items-center gap-2">
                Icon:
                <Popover
                  open={isIconPickerOpen}
                  onOpenChange={setIconPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="inline-block text-3xl py-0 px-2"
                    >
                      {icon || "Icon"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <EmojiPicker
                      onEmojiClick={(event) => {
                        setValue("icon", event.emoji);
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

              <TabsList>
                <TabsTrigger value={TabName.Json}>JSON</TabsTrigger>
                <TabsTrigger value={TabName.Form}>Form</TabsTrigger>
              </TabsList>

              <TabsContent value={TabName.Json} className="m-0 w-full">
                <MonacoEditor
                  height="304px"
                  width={"100%"}
                  defaultLanguage="json"
                  language="json"
                  value={jsonContent}
                  onChange={handleJsonChange}
                  options={{
                    autoClosingBrackets: "always",
                    autoClosingQuotes: "always",
                    autoIndent: "full",
                    minimap: { enabled: false },
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                  theme={monacoEditorTheme}
                />
              </TabsContent>

              <TabsContent value={TabName.Form} className="contents">
                <Label className="flex flex-col gap-2 w-full">
                  Server Name:
                  <Input
                    {...register("name", { required: true })}
                    placeholder="Unique server name, e.g. 'My MCP Server'"
                  />
                </Label>
                <Label className="flex flex-col gap-2 w-full">
                  Command:
                  <Input
                    {...register("command", {
                      required: true,
                    })}
                    placeholder="CLI executable, e.g. 'mcp-server'"
                  />
                </Label>
                <Label className="flex flex-col gap-2 w-full">
                  Args:
                  <Input
                    {...register("args")}
                    placeholder="CLI command arguments (optional), e.g. '--port 1234 --hello world'"
                  />
                </Label>
                <Label className="flex flex-col gap-2 w-full">
                  Environment Variables (JSON):
                  <Textarea
                    {...register("env", {
                      onChange: (e) => {
                        if (submitCount > 0 || isValidJson(e.target.value)) {
                          trigger("env");
                        }
                      },
                      validate: (value) => {
                        if (!value) return undefined; // Allow empty value
                        if (isValidJson(value)) {
                          return undefined;
                        }
                        return "Invalid JSON format";
                      },
                    })}
                    placeholder={`JSON object, e.g. '{ "KEY": "value" }'`}
                  />
                </Label>
              </TabsContent>
            </div>

            <DialogFooter className="gap-3 p-6 border-t border-[var(--color-border-primary)]">
              {onClose && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)]"
                  type="button"
                >
                  Cancel
                </Button>
              )}
              <Button
                disabled={isPending}
                className="bg-[var(--color-fg-interactive)] hover:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
              >
                {isPending ? "Adding..." : "Add Server"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Tabs>
    </Dialog>
  );
};
