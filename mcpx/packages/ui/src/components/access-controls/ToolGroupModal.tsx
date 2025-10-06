import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToolGroup } from "@/store";
import { BookmarkPlus } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm, UseFormRegisterReturn } from "react-hook-form";
import { ToolGroupForm } from "./ToolGroupForm";

export function ToolGroupModal({
  initialData,
  mcpServers,
  onClose,
  saveToolGroup,
  toolGroups,
}: {
  initialData?: ToolGroup | null;
  mcpServers: {
    name: string;
    tools: {
      name: string;
      description: string | undefined;
    }[];
  }[];
  onClose: () => void;
  saveToolGroup: (data: ToolGroup) => void;
  toolGroups: ToolGroup[];
}) {
  const [isNewGroup] = useState(
    !toolGroups.some((g) => g.id === initialData?.id),
  );
  const [selectedTools, setSelectedTools] = useState(
    Object.fromEntries(
      Object.entries(initialData?.services || {}).map(([server, tools]) => [
        server,
        Object.fromEntries(tools.map((tool) => [tool, true])),
      ]),
    ),
  );
  const form = useForm({
    defaultValues: {
      name: initialData?.name || "",
    },
  });

  const { handleSubmit, register } = form;

  const validateToolGroupName = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return "Group name is required";
    if (
      toolGroups.some(
        (g) => g.name === trimmedValue && g.id !== initialData?.id,
      )
    ) {
      return "Group name must be unique";
    }
    return true;
  };

  const registerNameField: () => UseFormRegisterReturn<"name"> = () =>
    register("name", {
      required: "Group name is required",
      validate: validateToolGroupName,
      maxLength: {
        value: 120,
        message: "Group name must not exceed 120 characters",
      },
    });

  const onSubmit = (data: any) => {
    const groupServices = Object.fromEntries(
      Object.entries(selectedTools).map(([server, tools]) => [
        server,
        Object.keys(
          Object.fromEntries(
            Object.entries(tools).filter(([, selected]) => selected),
          ),
        ),
      ]),
    );
    saveToolGroup({
      id: initialData?.id || "",
      name: data.name,
      services: groupServices,
    });
    form.setValue("name", "");
    setSelectedTools({});
    onClose();
  };

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      open
    >

      <DialogContent className="max-w-[640px] border border-[var(--color-border-primary)] rounded-lg bg-[var(--color-bg-container)]">

        <DialogTitle> </DialogTitle>  <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {isNewGroup ? "Create New" : "Edit"} Tool Group
              </DialogTitle>
              <DialogDescription>
                {isNewGroup 
                  ? "Create a new tool group to organize and manage access to specific tools."
                  : "Edit the tool group settings and permissions."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4">
              <ScrollArea className="max-h-[400px] overflow-y-auto">
                <ToolGroupForm
                  mcpServers={mcpServers}
                  registerNameField={registerNameField}
                  selectedTools={selectedTools}
                  setSelectedTools={setSelectedTools}
                />
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                className="bg-[var(--color-bg-success)] text-[var(--color-fg-success)] hover:bg-[var(--color-bg-success-hover)] hover:text-[var(--color-fg-success-hover)] focus:bg-[var(--color-bg-success-hover)] focus:text-[var(--color-fg-success-hover)]"
              >
                <BookmarkPlus className="w-4 h-4 mr-2" />
                {isNewGroup ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
