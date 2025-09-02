import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ToolDetails } from "@/types";

export const ToolDetailsModal = ({
  onClose,
  onCustomize,
  tool,
}: {
  onClose: () => void;
  onCustomize?: () => void;
  tool: ToolDetails;
}) => {
  const {
    description,
    name,
    serviceName,
    originalToolName,
    params,
    overrideParams,
  } = tool;

  const hasOverrideParams = Object.values(overrideParams || {}).some(
    (value) => value,
  );

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[var(--color-bg-container)] p-0 max-w-lg">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>
            {overrideParams ? "Custom" : "Server"} Tool Details
          </DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-2">
              Server:
              <span className="font-semibold text-[var(--color-fg-interactive)]">
                {serviceName}
              </span>
            </span>
            {originalToolName && (
              <span className="flex items-center gap-2">
                Original Tool Name:
                <span className="font-semibold text-[var(--color-fg-interactive)]">
                  {originalToolName}
                </span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-6 pt-4 pb-8">
          <h2 className="text-lg font-semibold">Properties</h2>
          <div className="grid gap-3 mb-6 mt-4 px-4">
            <div className="flex items-start gap-2 leading-[24px]">
              <div className="leading-[24px]">Name:</div>
              <span className="text-sm text-[var(--color-fg-interactive)] font-semibold leading-[24px]">
                {name}
              </span>
            </div>
            <div className="flex items-start gap-2 leading-[24px]">
              <div className="">Description: </div>
              <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-[24px]">
                {description}
              </div>
            </div>
          </div>
          <h2 className="text-lg font-semibold mt-8">Parameters</h2>
          <div className="grid gap-3 px-4">
            {params?.length
              ? params.map((param) => (
                  <div key={param.name} className="grid gap-2 mt-4">
                    <div className="flex items-center gap-2">
                      <code>{param.name}</code>
                      <Separator
                        orientation="vertical"
                        className="bg-border h-full"
                      />
                      {param.type && (
                        <p className="text-xs text-muted-foreground">
                          {param.type}
                        </p>
                      )}
                    </div>
                    {param.description && (
                      <p className="text-xs text-muted-foreground">
                        {param.description}
                      </p>
                    )}
                  </div>
                ))
              : null}
          </div>
          {hasOverrideParams ? (
            <>
              <h2 className="text-lg font-semibold mt-8">
                Override Parameters
              </h2>
              <div className="grid gap-3 px-4">
                {Object.entries(overrideParams || {})
                  .filter(([_, value]) => value !== undefined)
                  .map(([name, value]) => (
                    <div key={name} className="grid gap-2 mt-4">
                      <div className="flex items-center gap-2">
                        <code>{name}</code>
                        <Separator
                          orientation="vertical"
                          className="bg-border h-full"
                        />
                        <code className="text-xs text-[var(--color-fg-interactive)]">
                          {JSON.stringify(value, null, 2)}
                        </code>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter className="flex justify-end items-end p-6">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button variant="outline" onClick={onCustomize}>
            {tool.originalToolName ? "Edit" : "Customize"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
