import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CustomTool } from "@/store";
import { inputSchemaToParamsList } from "@/utils";
import { JsonSchemaType } from "@/utils/jsonUtils";
import { injectParamsListOverrides } from "@/utils/override-params";
import { generateDefaultValue } from "@/utils/schemaUtils";
import { ToolExtensionParamsRecord } from "@mcpx/shared-model";
import { BookmarkPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import DynamicJsonForm from "./DynamicJsonForm";

export type CustomToolResult = Pick<CustomTool, "description" | "name"> & {
  overrideParams: ToolExtensionParamsRecord;
};

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9-_]+$/;
const TOOL_NAME_PATTERN_MESSAGE =
  "Tool name can only contain letters, numbers, dashes, and underscores";
const validateToolNamePattern = (name: string) => TOOL_NAME_PATTERN.test(name);

export const CustomToolModal = ({
  handleSubmitTool,
  onClose,
  tool,
  validateUniqueToolName,
}: {
  handleSubmitTool: (tool: CustomTool, isNew: boolean) => void;
  onClose: () => void;
  tool: CustomTool;
  validateUniqueToolName: (name: string, serviceName: string) => boolean;
}) => {
  const { description, name, originalTool, overrideParams } = tool;

  const isNewTool = !name || !originalTool.id;
  const paramsList = injectParamsListOverrides(
    inputSchemaToParamsList(originalTool.inputSchema),
    overrideParams,
  );

  const {
    formState: { errors, isDirty, isSubmitting },
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
      overrideParams: Object.fromEntries(
        paramsList.map(({ name, value }) => [
          name,
          {
            value: value === undefined ? "" : value,
          } as any,
        ]),
      ),
    },
  });

  const handleClose = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (
      !isDirty ||
      confirm("Close Configuration? Changes you made have not been saved")
    ) {
      onClose();
    }
    e?.preventDefault();
    e?.stopPropagation();
  };

  return (
    <Dialog onOpenChange={(open) => !open && handleClose()} open>
      <DialogContent
        className="bg-[var(--color-bg-container)] p-0 max-w-3xl"
        onDismiss={handleClose}
        onEscapeKeyDown={handleClose}
        onPointerDownOutside={handleClose}
      >
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
                    validate: (value) => {
                      if (!isNewTool) return true;
                      if (!validateToolNamePattern(value))
                        return TOOL_NAME_PATTERN_MESSAGE;
                      if (
                        !validateUniqueToolName(value, originalTool.serviceName)
                      )
                        return "Tool name must be unique";
                      return true;
                    },
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
                  {errors.name?.message || "Invalid tool name"}
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
              {paramsList.map(({ name, type, description }) => (
                <div key={name} className="grid gap-2 mt-4">
                  <Label
                    htmlFor={`overrideParams.${name}.value`}
                    className="flex items-center justify-start gap-2 text-md"
                  >
                    {name}
                  </Label>
                  {type === "string" && (
                    <Input
                      id={`overrideParams.${name}.value`}
                      placeholder={`Enter ${type} value`}
                      type="text"
                      {...register(`overrideParams.${name}.value`, {
                        setValueAs: (value) => {
                          if (!value.trim()) return undefined;
                          return value;
                        },
                        validate:
                          (
                            originalTool.inputSchema?.properties?.[
                              name
                            ] as JsonSchemaType
                          )?.enum ||
                          originalTool.inputSchema?.required?.includes(name)
                            ? (value) => {
                                if (!value) return undefined;
                                const enumValues = (
                                  originalTool.inputSchema?.properties?.[
                                    name
                                  ] as JsonSchemaType
                                )?.enum as string[];
                                if (
                                  enumValues &&
                                  !enumValues.includes(value as string)
                                ) {
                                  return `Must be one of: ${enumValues.join(", ")}`;
                                }
                                return true;
                              }
                            : undefined,
                        value:
                          watch(`overrideParams.${name}.value`) || undefined,
                      })}
                    />
                  )}
                  {(type === "number" || type === "integer") && (
                    <Input
                      id={`overrideParams.${name}.value`}
                      placeholder={`Enter ${type} value`}
                      type="number"
                      step={type === "integer" ? 1 : undefined}
                      {...register(`overrideParams.${name}.value`, {
                        setValueAs: (value) => {
                          if (value === "") return undefined;
                          const numValue = Number(value);
                          return Number.isNaN(numValue)
                            ? undefined
                            : type === "integer"
                              ? Math.floor(numValue)
                              : numValue;
                        },
                        value:
                          watch(`overrideParams.${name}.value`) || undefined,
                      })}
                    />
                  )}
                  {type === "boolean" && (
                    <Combobox
                      buttonLabel={
                        watch(`overrideParams.${name}.value`) === true
                          ? "Yes"
                          : watch(`overrideParams.${name}.value`) === false
                            ? "No"
                            : "N/A"
                      }
                      buttonProps={{
                        className: `h-[30px] w-[180px] px-3 bg-[var(--color-bg-neutral)] text-muted-foreground ${
                          typeof watch(`overrideParams.${name}.value`) ===
                          "boolean"
                            ? " text-[var(--color-text-primary)] bg-transparent"
                            : ""
                        }`,
                      }}
                      onChange={(values: string[]) => {
                        const [value] = values;
                        if (value === "true") {
                          setValue(`overrideParams.${name}.value`, true, {
                            shouldDirty: true,
                          });
                        }
                        if (value === "false") {
                          setValue(`overrideParams.${name}.value`, false, {
                            shouldDirty: true,
                          });
                        }
                        if (value === "N/A") {
                          setValue(`overrideParams.${name}.value`, undefined, {
                            shouldDirty: true,
                          });
                        }
                      }}
                      options={[
                        { label: "N/A", value: "N/A" },
                        { label: "No", value: "false" },
                        { label: "Yes", value: "true" },
                      ]}
                      values={[
                        JSON.stringify(watch(`overrideParams.${name}.value`)) ??
                          "N/A",
                      ]}
                      disableSearch
                    />
                  )}
                  {(type === "array" || type === "object") && (
                    <DynamicJsonForm
                      schema={{
                        ...(originalTool.inputSchema?.properties?.[
                          name
                        ] as JsonSchemaType),
                        default: generateDefaultValue(
                          originalTool.inputSchema?.properties?.[
                            name
                          ] as JsonSchemaType,
                          name,
                        ),
                      }}
                      value={watch(`overrideParams.${name}.value`) || undefined}
                      onChange={(value) => {
                        setValue(`overrideParams.${name}.value`, value, {
                          shouldDirty: true,
                        });
                      }}
                    />
                  )}
                  {description && (
                    <p className="text-xs text-gray-500">{description}</p>
                  )}
                  <p
                    className={cn(
                      "text-sm text-[var(--color-fg-danger)] invisible",
                      {
                        visible: (errors as any).overrideParams?.[name],
                      },
                    )}
                  >
                    {(errors as any).overrideParams?.[name]?.message ||
                      "&nbsp;"}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex justify-end items-end p-6">
            <Button
              variant="outline"
              className="bg-[var(--color-bg-neutral)] text-[var(--color-text-primary)] enabled:bg-[var(--color-bg-success)] enabled:text-[var(--color-fg-success)] hover:enabled:bg-[var(--color-bg-success-hover)] hover:enabled:text-[var(--color-fg-success-hover)] focus:enabled:bg-[var(--color-bg-success-hover)] focus:enabled:text-[var(--color-fg-success-hover)]"
              disabled={!isDirty || isSubmitting}
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
