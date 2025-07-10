import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookmarkPlus } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { ToolGroupForm } from "./ToolGroupForm";

export function ToolGroupModal({ mcpServers, onClose, saveNewToolGroup }) {
  const [expandedServers, setExpandedServers] = useState({});
  const [selectedTools, setSelectedTools] = useState({});
  const { handleSubmit, ...form } = useForm({
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = (data) => {
    const newGroupName = data.name.trim();

    if (newGroupName) {
      const newServices = Object.fromEntries(
        Object.entries(selectedTools).map(([server, tools]) => [
          server,
          Object.keys(tools),
        ]),
      );
      saveNewToolGroup({
        name: newGroupName,
        services: newServices,
      });
      form.setValue("name", "");
      setSelectedTools({});
      onClose();
    }
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
      <DialogContent className="max-w-[640px] border border-[var(--color-border-primary)] rounded-lg bg-background">
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create New Tool Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 p-4">
              <ScrollArea className="h-[400px] overflow-y-auto  border border-[var(--color-border-primary)] rounded-lg  bg-[var(--color-bg-container-overlay)]">
                <ToolGroupForm
                  expandedServers={expandedServers}
                  mcpServers={mcpServers}
                  selectedTools={selectedTools}
                  setExpandedServers={setExpandedServers}
                  setSelectedTools={setSelectedTools}
                />
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="bg-[var(--color-bg-success)] text-[var(--color-fg-success)] hover:bg-[var(--color-bg-success-hover)] hover:text-[var(--color-fg-success-hover)] focus:bg-[var(--color-bg-success-hover)] focus:text-[var(--color-fg-success-hover)]"
              >
                <BookmarkPlus className="w-4 h-4 mr-2" />
                Save Tool Group
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
