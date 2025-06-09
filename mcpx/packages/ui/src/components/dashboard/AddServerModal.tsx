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
import { Textarea } from "@/components/ui/textarea";
import { useAddMcpServer } from "@/data/mcp-server";
import { AlertCircle, FileText } from "lucide-react";
import { useCallback } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  CreateTargetServerRequest,
  createTargetServerRequestSchema,
} from "@mcpx/shared-model";

export default function AddServerModal({ isOpen, onClose }) {
  const { mutate: addServer, isPending, error } = useAddMcpServer();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTargetServerRequest>({});

  const handleAddServer = handleSubmit((inputs) => {
    const { name, command, args, env } = inputs;

    const serverConfig = createTargetServerRequestSchema.parse({
      name,
      command,
      args,
      env,
    });

    addServer(
      { payload: serverConfig },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error) => {
          console.error("Error adding server:", error);
        },
      },
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose || (() => {})}>
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

          <div className="flex-1 overflow-hidden p-6">
            {error && (
              <Alert
                variant="destructive"
                className="mb-4 bg-[var(--color-bg-danger)] border-[var(--color-border-danger)] text-[var(--color-fg-danger)]"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Tab Content */}
            <div className="space-y-4">
              <Input
                placeholder="Server Name"
                {...register("name", { required: true })}
              />
              <Input
                placeholder="Command"
                {...register("command", { required: true })}
              />
              <Input
                placeholder="Args"
                {...register("args", {
                  required: false,
                  setValueAs: (value: string) =>
                    value.split(" ").map((arg: string) => arg.trim()),
                })}
              />
              <Textarea
                placeholder="Env (JSON)"
                {...register("env", {
                  required: false,
                  setValueAs: (value: string) => {
                    try {
                      const val = JSON.parse(value);
                      if (typeof val === "object" && val !== null) {
                        return val;
                      } else {
                        console.error("Env must be a JSON object");
                        return {};
                      }
                    } catch (e) {
                      console.error("Invalid JSON in env field", e);
                      return {};
                    }
                  },
                })}
              />
            </div>
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
    </Dialog>
  );
}
