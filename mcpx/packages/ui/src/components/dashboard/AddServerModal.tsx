import { DEFAULT_SERVER_ICON } from "@/components/dashboard/constants";
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
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAddMcpServer } from "@/data/mcp-server";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSocketStore } from "@/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { RawCreateTargetServerRequest } from "@mcpx/shared-model";
import MonacoEditor, { Theme as MonacoEditorTheme } from "@monaco-editor/react";
import { AxiosError } from "axios";
import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { AlertCircle, FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod"; // zod/v4 doesn't work with the zodResolver as it expects a v3 schema

const TabName = {
  Json: "json",
  Form: "form",
} as const;

type Tab = (typeof TabName)[keyof typeof TabName];

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

const jsonStringSchema = z.string().refine((val) => {
  if (!val) return true; // Allow empty string
  try {
    JSON.parse(val);
    return true;
  } catch {
    return false;
  }
}, "Invalid JSON format");

const envStringSchema = jsonStringSchema.refine((val) => {
  if (!val) return true; // Allow empty string
  try {
    z.record(z.string(), z.string()).parse(JSON.parse(val));
    return true;
  } catch {
    return false;
  }
}, 'Environment variables must be a valid JSON object consisting of key-value pairs (e.g. { "KEY": "value" })');

const rawServerSchema = z.object({
  icon: z.string().optional().default(DEFAULT_SERVER_ICON),
  name: z.string().min(1, "Server name is required"),
  command: z.string().min(1, "Command is required"),
  args: z.string(),
  env: envStringSchema.optional(),
});

const JsonForm = ({
  jsonContent,
  setJsonContent,
  setIsJsonValid,
  setValue,
  colorScheme,
  setServerNameError,
  setShowInvalidJsonAlert,
}: {
  jsonContent: string;
  setJsonContent: (value: string) => void;
  setIsJsonValid: (isValid: boolean) => void;
  setValue: ReturnType<typeof useForm>["setValue"];
  colorScheme?: "light" | "dark";
  setServerNameError: (error: string) => void;
  setShowInvalidJsonAlert: (show: boolean) => void;
}) => {
  const monacoEditorTheme = useMemo<MonacoEditorTheme>(() => {
    return colorScheme === "dark" ? "vs-dark" : "light";
  }, [colorScheme]);

  const handleJsonChange = (value: string | undefined = "") => {
    setServerNameError("");

    if (value === INITIAL_VALUES_JSON) {
      return;
    }

    setJsonContent(value);

    if (value.length && !isValidJson(value)) {
      setIsJsonValid(false);
      setShowInvalidJsonAlert(true);
      return;
    }

    setShowInvalidJsonAlert(false);
    setIsJsonValid(true);

    if (!value) return;

    try {
      const parsed = JSON.parse(value);
      const parsedName = Object.keys(parsed)[0] || "";
      const parsedCommand = parsed?.[parsedName]?.command || "";
      const parsedArgs = parsed?.[parsedName]?.args?.join(" ") || "";
      const parsedEnv = parsed?.[parsedName]?.env || "";
      setValue("name", parsedName, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("command", parsedCommand, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue("args", parsedArgs, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
      setValue(
        "env",
        typeof parsedEnv === "object" &&
          parsedEnv !== null &&
          !Array.isArray(parsedEnv) &&
          Object.keys(parsedEnv).length > 0
          ? JSON.stringify(parsedEnv, null, 2)
          : "",
        {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        },
      );
    } catch (e) {
      console.error("Invalid JSON format:", e);
      setValue("name", "");
      setValue("command", "");
      setValue("args", "");
      setValue("env", "");
    }
  };

  return (
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
  );
};

const FormFields = ({
  register,
  submitCount,
  setIsJsonValid,
  trigger,
}: {
  register: ReturnType<typeof useForm>["register"];
  submitCount: number;
  setIsJsonValid: (isValid: boolean) => void;
  trigger: ReturnType<typeof useForm>["trigger"];
}) => {
  return (
    <>
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
          {...register("command", { required: true })}
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
              setIsJsonValid(false);
              return "Invalid JSON format";
            },
          })}
          placeholder={`JSON object, e.g. '{ "KEY": "value" }'`}
        />
      </Label>
    </>
  );
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
    formState: { errors, isDirty, submitCount },
    getValues,
    setValue,
    trigger,
    watch,
    setError,
  } = useForm<RawCreateTargetServerRequest>({
    defaultValues: {
      icon: DEFAULT_SERVER_ICON,
      name: INITIAL_SERVERNAME,
      command: INITIAL_COMMAND,
      args: INITIAL_ARGS,
      env: JSON.stringify(INITIAL_ENV, null, 2),
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
    resolver: zodResolver(rawServerSchema),
  });

  const icon = watch("icon");
  const name = watch("name");

  const [currentTab, setCurrentTab] = useState<Tab>(TabName.Json);
  const [isIconPickerOpen, setIconPickerOpen] = useState(false);
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [showInvalidJsonAlert, setShowInvalidJsonAlert] = useState(false);
  const [jsonContent, setJsonContent] = useState(INITIAL_VALUES_JSON);
  const [serverNameError, setServerNameError] = useState("");

  useEffect(() => {
    const existingServer = systemState?.targetServers.find(
      (server) => server.name === name,
    );
    if (existingServer) {
      setServerNameError(getServerExistsError(name));
    }
  }, [name, systemState?.targetServers]);

  const colorScheme = useColorScheme();
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
        return value.message;
      }
      return `${key} is ${value?.type}`;
    })
    .filter(Boolean);

  const handleAddServer = handleSubmit((inputs) => {
    clearErrors();
    setServerNameError("");

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
      setServerNameError(getServerExistsError(name));
      return;
    }

    if (name === INITIAL_SERVERNAME) {
      setServerNameError(getInitialServerNameError());
      return;
    }

    if (command === INITIAL_COMMAND) {
      setError("command", {
        type: "manual",
        message: getInitialCommandError(),
      });
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

  const handleTabsChange = async (value: string) => {
    if (!isJsonValid) {
      // If JSON is invalid, prevent switching to Form tab
      setShowInvalidJsonAlert(true);
      console.error("Cannot switch to Form tab, JSON is invalid");
      return;
    }

    // Trigger validation to ensure form values are up-to-date
    await trigger("env");

    if (value === TabName.Json) {
      // When switching to JSON tab, convert form values to JSON
      const { args, command, name, env } = getValues();
      try {
        let parsedEnv: object | null;
        try {
          parsedEnv = JSON.parse(env || "null");
        } catch {
          parsedEnv = null;
        }
        const json = {
          [name]: {
            command,
            args: args
              .split(" ")
              .map((arg) => arg.trim())
              .filter(Boolean),
            env: parsedEnv || {},
          },
        };

        if (name || command || args || parsedEnv) {
          setJsonContent(JSON.stringify(json, null, 2));
        } else {
          setJsonContent("");
        }

        setIsJsonValid(true);
      } catch (e) {
        console.error("Error converting form values to JSON:", e);
        setJsonContent("");
        setIsJsonValid(true);
      }
    } else if (value === TabName.Form) {
      // When switching to Form tab, parse the current JSON content
      try {
        const parsed = JSON.parse(jsonContent);
        const parsedName = Object.keys(parsed)[0] || "";
        const parsedCommand = parsed?.[parsedName]?.command || "";
        const parsedArgs = parsed?.[parsedName]?.args?.join(" ") || "";
        const parsedEnv = parsed?.[parsedName]?.env || "";
        setValue("name", parsedName);
        setValue("command", parsedCommand);
        setValue("args", parsedArgs);
        setValue(
          "env",
          typeof parsedEnv === "object" &&
            parsedEnv !== null &&
            !Array.isArray(parsedEnv) &&
            Object.keys(parsedEnv).length > 0
            ? JSON.stringify(parsedEnv, null, 2)
            : "",
        );
        setIsJsonValid(true);
      } catch (e) {
        setValue("name", "");
        setValue("command", "");
        setValue("args", "");
        setValue("env", "");
        setIsJsonValid(true);
      }
    }

    clearErrors();
    setServerNameError("");
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
              {submitCount > 0 && showInvalidJsonAlert && (
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

              {submitCount > 0 && serverErrorMessage && (
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

              {submitCount > 0 && serverNameError && (
                <Alert
                  variant="destructive"
                  className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{serverNameError}</AlertDescription>
                  </div>
                </Alert>
              )}

              {submitCount > 0 && fieldErrors.length > 0 && (
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
                      {icon || DEFAULT_SERVER_ICON}
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
                <JsonForm
                  jsonContent={jsonContent}
                  setJsonContent={setJsonContent}
                  setIsJsonValid={setIsJsonValid}
                  setValue={setValue}
                  colorScheme={colorScheme}
                  setServerNameError={setServerNameError}
                  setShowInvalidJsonAlert={setShowInvalidJsonAlert}
                />
              </TabsContent>

              <TabsContent value={TabName.Form} className="contents">
                <FormFields
                  register={register}
                  errors={errors}
                  submitCount={submitCount}
                  isJsonValid={isJsonValid}
                  setIsJsonValid={setIsJsonValid}
                  setValue={setValue}
                  trigger={trigger}
                />
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
                disabled={
                  isPending ||
                  !isDirty ||
                  (currentTab === "json" && !isJsonValid)
                }
                className="bg-[var(--color-fg-interactive)] hover:enabled:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
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
          </form>
        </DialogContent>
      </Tabs>
    </Dialog>
  );
};
