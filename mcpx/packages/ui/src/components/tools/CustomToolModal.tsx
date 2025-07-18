import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CustomTool } from "@/store";
import { injectParamsListOverrides, inputSchemaToParamsList } from "@/utils";
import { BookmarkPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Spinner } from "../ui/spinner";

export type CustomToolResult = Pick<CustomTool, "description" | "name"> & {
  overrideParams: Record<string, string | number | boolean | undefined>;
};

export const CustomToolModal = ({
  handleSubmitTool,
  onClose,
  tool,
}: {
  handleSubmitTool: (tool: CustomTool, isNew: boolean) => void;
  onClose: () => void;
  tool: CustomTool;
}) => {
  const { description, name, originalTool, overrideParams } = tool;

  const isNewTool = !name || !originalTool.id;

  const paramsList = injectParamsListOverrides(
    inputSchemaToParamsList(originalTool.inputSchema),
    overrideParams,
  );

  const {
    formState: { errors, isDirty, isSubmitting, isValid },
    handleSubmit,
    register,
    watch,
    setValue,
  } = useForm<CustomToolResult>({
    defaultValues: {
      description: {
        action: description?.action || "rewrite",
        text: description?.text || "",
      },
      name,
      overrideParams: {
        ...Object.fromEntries(
          paramsList.map(({ name, value }) => [name, value]),
        ),
      },
    },
  });

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[var(--color-bg-container)] p-0 max-w-3xl">
        <form
          onSubmit={handleSubmit((data) =>
            handleSubmitTool({ originalTool, ...data }, isNewTool),
          )}
          className="w-full"
        >
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>
              {isNewTool ? "Create" : "Edit"} Custom Tool
            </DialogTitle>
            <DialogDescription>
              <span className="flex items-center gap-2">
                Server:
                <span className="font-semibold text-[var(--color-fg-interactive)]">
                  {originalTool.serviceName}
                </span>
              </span>
              <span className="flex items-center gap-2">
                Original tool:
                <span className="font-semibold text-[var(--color-fg-interactive)]">
                  {originalTool.name}
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-6 pt-4 pb-8">
            <h2 className="text-lg font-semibold">Properties</h2>
            <div className="grid gap-3 mb-6 px-4">
              <div className="grid gap-2 mt-4">
                <Label htmlFor="toolName" className="text-md">
                  Name {isNewTool ? "(required)" : "(read-only)"}
                </Label>
                <Input
                  id="toolName"
                  placeholder={`Enter tool name`}
                  {...register("name", {
                    required: "Tool name is required",
                  })}
                  disabled={!isNewTool}
                  className={cn({
                    "disabled:cursor-text text-[var(--color-fg-interactive)] disabled:opacity-100":
                      !isNewTool,
                  })}
                />
                <p
                  className={cn(
                    "text-sm text-[var(--color-fg-danger)] invisible",
                    {
                      visible: errors.name,
                    },
                  )}
                >
                  {errors.name?.message || "&nbsp;"}
                </p>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="toolDescriptionText" className="grow text-md">
                    Description
                  </Label>
                  <div className="flex items-center">
                    <Label className="flex items-center justify-between capitalize w-[90px] cursor-pointer">
                      <Switch
                        checked={watch("description.action") === "rewrite"}
                        onCheckedChange={(value) => {
                          setValue(
                            "description.action",
                            value ? "rewrite" : "append",
                            { shouldDirty: true },
                          );
                        }}
                        {...register("description.action")}
                      />
                      {watch("description.action")}
                    </Label>
                  </div>
                </div>
                <Input
                  id="toolDescriptionText"
                  defaultValue={description}
                  placeholder={`Enter tool description`}
                  {...register("description.text")}
                />
              </div>
            </div>
            <h2 className="text-lg font-semibold mt-8">Parameters</h2>
            <div className="grid gap-3 px-4">
              {paramsList.map(({ name, type, description, value }) => (
                <div key={name} className="grid gap-2 mt-4">
                  <Label
                    htmlFor={`param-${name}`}
                    className="flex items-center justify-start gap-2 text-md"
                  >
                    {name}
                  </Label>
                  {(type === "string" || type === "number") && (
                    <Input
                      id={`param-${name}`}
                      placeholder={`Enter ${type} value`}
                      type={type === "number" ? "number" : "text"}
                      {...register(`overrideParams.${name}`, {
                        setValueAs: (value) => {
                          if (value === "") return undefined;
                          if (type === "number") {
                            const numValue = Number(value);
                            return Number.isNaN(numValue)
                              ? undefined
                              : numValue;
                          }
                          return value;
                        },
                        value: watch(`overrideParams.${name}`) || undefined,
                      })}
                    />
                  )}
                  {type === "boolean" && (
                    <Label
                      htmlFor={`param-${name}`}
                      className="flex items-center gap-2 cursor-pointer w-[min-content]"
                    >
                      <Checkbox
                        id={`param-${name}`}
                        checked={
                          watch(`overrideParams.${name}`) === true
                            ? true
                            : watch(`overrideParams.${name}`) === false
                              ? false
                              : false
                        }
                        onCheckedChange={() => {
                          if (watch(`overrideParams.${name}`) === true) {
                            setValue(`overrideParams.${name}`, undefined);
                          } else if (
                            watch(`overrideParams.${name}`) === false
                          ) {
                            setValue(`overrideParams.${name}`, true);
                          } else {
                            setValue(`overrideParams.${name}`, false);
                          }
                        }}
                        className={cn({
                          "border-[text-muted-foreground]":
                            watch(`overrideParams.${name}`) === undefined,
                        })}
                        {...register(`overrideParams.${name}`, {
                          setValueAs: (value) =>
                            value === true
                              ? true
                              : value === false
                                ? false
                                : undefined,
                        })}
                      />
                      {watch(`overrideParams.${name}`) === true
                        ? "Yes"
                        : watch(`overrideParams.${name}`) === false
                          ? "No"
                          : "N/A"}
                    </Label>
                  )}
                  {description && (
                    <p className="text-xs text-gray-500">{description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex justify-end items-end p-6">
            <Button
              variant="outline"
              className="bg-[var(--color-bg-neutral)] text-[var(--color-text-primary)] enabled:bg-[var(--color-bg-success)] enabled:text-[var(--color-fg-success)] hover:enabled:bg-[var(--color-bg-success-hover)] hover:enabled:text-[var(--color-fg-success-hover)] focus:enabled:bg-[var(--color-bg-success-hover)] focus:enabled:text-[var(--color-fg-success-hover)]"
              disabled={!isDirty || !isValid || isSubmitting}
            >
              <BookmarkPlus className="w-4 h-4 mr-2" />
              {isSubmitting ? (
                <>
                  Saving...
                  <Spinner />
                </>
              ) : isNewTool ? (
                "Create"
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
