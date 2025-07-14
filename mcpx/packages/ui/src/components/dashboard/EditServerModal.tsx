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
import { Textarea } from "@/components/ui/textarea";
import { useEditMcpServer } from "@/data/mcp-server";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useModalsStore } from "@/store";
import { RawUpdateTargetServerRequest } from "@mcpx/shared-model";
import { AxiosError } from "axios";
import EmojiPicker, { Theme as EmojiPickerTheme } from "emoji-picker-react";
import { AlertCircle, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Spinner } from "../ui/spinner";
import { DEFAULT_SERVER_ICON } from "./constants";

const isValidJson = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
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
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RawUpdateTargetServerRequest>({
    defaultValues: {
      icon: initialData?.icon || DEFAULT_SERVER_ICON,
      command: initialData?.command,
      args: initialData?.args,
      env: JSON.stringify(JSON.parse(initialData?.env || "{}"), null, 2),
    },
  });

  const handleEditServer = handleSubmit((inputs) => {
    if (!initialData?.name) {
      console.error("No server name provided");
      return;
    }

    const { icon, args, command, env } = inputs;

    editServer(
      {
        name: initialData.name,
        payload: {
          args,
          command,
          env,
          icon,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error) => {
          console.error("Error editing server:", error);
        },
      },
    );
  });

  const [isIconPickerOpen, setIconPickerOpen] = useState(false);

  const colorScheme = useColorScheme();
  const emojiPickerTheme = useMemo<EmojiPickerTheme>(() => {
    return colorScheme === "dark"
      ? EmojiPickerTheme.DARK
      : EmojiPickerTheme.LIGHT;
  }, [colorScheme]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose || (() => {})}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col bg-[var(--color-bg-container)] border border-[var(--color-border-primary)] rounded-lg">
        <form className="space-y-4" onSubmit={handleEditServer}>
          <DialogHeader className="border-b border-[var(--color-border-primary)] p-6">
            <DialogTitle className="flex items-center gap-2 text-2xl text-[var(--color-text-primary)]">
              <FileText className="w-6 h-6 text-[var(--color-fg-interactive)]" />
              Edit Server <i>{name}</i>
            </DialogTitle>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Edit MCP server configuration.
            </p>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Modify the fields below to update the server's settings.
            </p>
          </DialogHeader>

          <div className="flex flex-col flex-1 overflow-hidden p-6 gap-4 items-start">
            {error && (
              <Alert
                variant="destructive"
                className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error instanceof AxiosError
                    ? error.response?.data.msg
                    : error.message ||
                      "Failed to edit server. Please try again."}
                </AlertDescription>
              </Alert>
            )}

            <Label className="inline-flex flex-0 items-center gap-2">
              Icon:
              <Popover open={isIconPickerOpen} onOpenChange={setIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="inline-block text-3xl py-0 px-2"
                  >
                    {watch("icon")}
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
            <Label className="flex flex-col gap-2 w-full">
              Command:
              <Input {...register("command")} />
            </Label>
            <Label className="flex flex-col gap-2 w-full">
              Args:
              <Input {...register("args")} />
            </Label>
            <Label className="flex flex-col gap-2 w-full">
              Environment Variables (JSON):
              <Textarea
                {...register("env", {
                  validate: (value) => {
                    if (!value) return undefined; // Allow empty value
                    if (isValidJson(value)) {
                      return undefined;
                    }
                    return "Invalid JSON format";
                  },
                })}
              />
            </Label>
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
              className="bg-[var(--color-fg-interactive)] hover:enabled:bg-[var(--color-fg-interactive-hover)] text-[var(--color-text-primary-inverted)]"
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
        </form>
      </DialogContent>
    </Dialog>
  );
};
