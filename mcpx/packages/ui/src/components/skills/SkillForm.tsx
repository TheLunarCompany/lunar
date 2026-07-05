import { MarkdownContent } from "@/components/MarkdownContent";
import { CapabilityGroupCard } from "@/components/capabilities/CapabilityGroupCard";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SkillToolGroupOption } from "@/mapping/skills";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  skillCapabilityGroupSchema,
  type SkillDraft,
} from "@mcpx/shared-model";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
// import { SkillToolGroupField } from "./SkillToolGroupField";
import {
  draftToFormValues,
  formValuesToDraft,
  skillFormSchema,
  type SkillFormValues,
} from "./skill-form-schema";

type SkillFormProps = {
  defaultValues?: SkillDraft;
  submitLabel: string;
  status?: "idle" | "submitting";
  onSubmit: (draft: SkillDraft) => Promise<void> | void;
  toolGroupOptions?: SkillToolGroupOption[];
  className?: string;
};

type ToolGroupComboboxOption = SkillToolGroupOption;

export function SkillForm({
  defaultValues,
  submitLabel,
  status = "idle",
  onSubmit,
  toolGroupOptions = [],
  className,
}: SkillFormProps) {
  const [bodyMode, setBodyMode] = useState<"raw" | "preview">("raw");
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: draftToFormValues(defaultValues),
  });

  const isSubmitting = status === "submitting";

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(formValuesToDraft(values));
    } catch {
      // parent surfaces the error via toast; keep the form populated
    }
  });

  return (
    <form
      onSubmit={submit}
      className={cn("flex h-full min-h-0 flex-col", className)}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
        <div className="space-y-2">
          <Label htmlFor="skill-name">Name</Label>
          <Controller
            name="name"
            control={control}
            render={({ field }) => {
              const { ref: _ref, ...inputProps } = field;
              return (
                <Input
                  id="skill-name"
                  aria-invalid={Boolean(errors.name)}
                  className="bg-[var(--structure-color-bg-container)]"
                  {...inputProps}
                />
              );
            }}
          />
          {errors.name ? <ErrorText>{errors.name.message}</ErrorText> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="skill-description">Description</Label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => {
              const { ref: _ref, ...textareaProps } = field;
              return (
                <Textarea
                  id="skill-description"
                  aria-invalid={Boolean(errors.description)}
                  className="min-h-20 resize-y bg-[var(--structure-color-bg-container)]"
                  {...textareaProps}
                />
              );
            }}
          />
          {errors.description ? (
            <ErrorText>{errors.description.message}</ErrorText>
          ) : null}
        </div>
        <Controller
          name="exposeAsPrompt"
          control={control}
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container)] px-3 py-2">
              <Label htmlFor="skill-expose-as-prompt">Expose as prompt</Label>
              <Switch
                id="skill-expose-as-prompt"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />
        {toolGroupOptions.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="skill-tool-group">Tool group</Label>
            <Controller
              name="toolGroupJson"
              control={control}
              render={({ field }) => {
                const selectedOption = getSelectedToolGroupOption(
                  toolGroupOptions,
                  field.value,
                );

                return (
                  <ToolGroupCombobox
                    options={toolGroupOptions}
                    selectedOption={selectedOption}
                    onChange={(option) => {
                      if (!option?.capabilityGroup) {
                        field.onChange("");
                        return;
                      }
                      field.onChange(
                        JSON.stringify(option.capabilityGroup, null, 2),
                      );
                    }}
                  >
                    <ToolGroupHelpText
                      selectedOption={selectedOption}
                      options={toolGroupOptions}
                    />
                    <SelectedToolGroupProviders option={selectedOption} />
                  </ToolGroupCombobox>
                );
              }}
            />
            {errors.toolGroupJson ? (
              <ErrorText>{errors.toolGroupJson.message}</ErrorText>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="skill-body">Markdown body</Label>
            <Tabs
              value={bodyMode}
              onValueChange={(value) =>
                setBodyMode(value === "preview" ? "preview" : "raw")
              }
            >
              <TabsList aria-label="Markdown body mode">
                <TabsTrigger value="raw">Raw</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Controller
            name="body"
            control={control}
            render={({ field }) => {
              const { ref: _ref, ...textareaProps } = field;
              return (
                <>
                  {bodyMode === "raw" ? (
                    <Textarea
                      id="skill-body"
                      aria-invalid={Boolean(errors.body)}
                      className="min-h-56 resize-y bg-[var(--structure-color-bg-container)] font-mono text-sm"
                      {...textareaProps}
                    />
                  ) : (
                    <div className="min-h-56 rounded-md border border-[var(--structure-color-border-primary)] bg-[var(--structure-color-bg-container)] p-3">
                      {field.value.trim() ? (
                        <MarkdownContent content={field.value} />
                      ) : (
                        <p className="text-sm text-[var(--text-colours-color-text-secondary)]">
                          Nothing to preview.
                        </p>
                      )}
                    </div>
                  )}
                </>
              );
            }}
          />
          {errors.body ? <ErrorText>{errors.body.message}</ErrorText> : null}
        </div>
        {/* <Controller
          name="toolGroupJson"
          control={control}
          render={({ field }) => (
            <SkillToolGroupField
              value={field.value}
              onChange={field.onChange}
              error={errors.toolGroupJson?.message}
            />
          )}
        /> */}
      </div>
      <div className="flex shrink-0 justify-end px-5 py-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function getSelectedToolGroupOption(
  options: SkillToolGroupOption[],
  value: string,
) {
  const parsed = parseToolGroupJson(value);
  if (!parsed) return null;

  return (
    options.find(
      (option) =>
        option.capabilityGroup &&
        JSON.stringify(option.capabilityGroup) === JSON.stringify(parsed),
    ) ?? null
  );
}

function parseToolGroupJson(value: string) {
  if (!value.trim()) return null;
  try {
    const parsed = skillCapabilityGroupSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function ToolGroupCombobox({
  options,
  selectedOption,
  onChange,
  children,
}: {
  options: SkillToolGroupOption[];
  selectedOption: SkillToolGroupOption | null;
  onChange: (option: ToolGroupComboboxOption | null) => void;
  children: React.ReactNode;
}) {
  const anchorRef = useComboboxAnchor();
  const [inputValue, setInputValue] = useState(selectedOption?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const comboboxOptions: ToolGroupComboboxOption[] = options;

  return (
    <Combobox
      items={comboboxOptions}
      value={selectedOption}
      inputValue={inputValue}
      open={isOpen}
      openOnInputClick
      itemToStringLabel={getToolGroupComboboxLabel}
      isItemEqualToValue={(item, value) => item.id === value.id}
      onOpenChange={setIsOpen}
      onInputValueChange={(nextValue) => {
        setInputValue(nextValue);
        if (nextValue === "") {
          onChange(null);
        }
      }}
      onValueChange={(option) => {
        if (!option || Array.isArray(option)) return;
        const nextOption = option as ToolGroupComboboxOption;
        setInputValue(nextOption.name);
        onChange(nextOption);
      }}
    >
      <div ref={anchorRef} className="w-full">
        <ComboboxInput
          id="skill-tool-group"
          aria-label="Tool group"
          placeholder="Search by tool group name or MCP server (e.g. figma, linear)"
          className="w-full bg-[var(--structure-color-bg-container)]"
          showClear={inputValue !== ""}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
        />
      </div>
      <ComboboxContent anchor={anchorRef} initialFocus={false}>
        <ComboboxEmpty>No tool groups found.</ComboboxEmpty>
        <ComboboxList>
          {(option) => (
            <ComboboxItem
              key={(option as ToolGroupComboboxOption).id}
              value={option}
              disabled={Boolean(
                (option as ToolGroupComboboxOption).disabledReason,
              )}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium">
                  {(option as ToolGroupComboboxOption).name}
                </span>
                <ToolGroupOptionProviders
                  option={option as ToolGroupComboboxOption}
                />
                {(option as ToolGroupComboboxOption).disabledReason ? (
                  <span className="truncate text-xs text-[var(--text-colours-color-text-secondary)]">
                    {(option as ToolGroupComboboxOption).disabledReason}
                  </span>
                ) : null}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
      {children}
    </Combobox>
  );
}

function getToolGroupComboboxLabel(option: ToolGroupComboboxOption) {
  const providerNames =
    option.providers?.map((provider) => provider.providerName).join(" ") ?? "";

  return [option.name, providerNames].filter(Boolean).join(" ");
}

function ToolGroupOptionProviders({
  option,
}: {
  option: ToolGroupComboboxOption;
}) {
  if (!option.providers?.length) return null;

  return (
    <span className="flex flex-wrap gap-1">
      {option.providers.map((provider) => (
        <CapabilityGroupCard.ProviderBadge
          key={provider.providerName}
          name={provider.providerName}
          toolsNumber={provider.itemCount}
        />
      ))}
    </span>
  );
}

function ToolGroupHelpText({
  selectedOption,
  options,
}: {
  selectedOption: SkillToolGroupOption | null;
  options: SkillToolGroupOption[];
}) {
  const unavailableCount = options.filter(
    (option) => !option.capabilityGroup,
  ).length;

  if (selectedOption?.description) {
    return (
      <p className="text-sm text-[var(--text-colours-color-text-secondary)]">
        {selectedOption.description}
      </p>
    );
  }

  if (unavailableCount > 0) {
    return (
      <p className="text-sm text-[var(--text-colours-color-text-secondary)]">
        {unavailableCount} tool group
        {unavailableCount === 1 ? "" : "s"} cannot be used because catalog item
        IDs are missing.
      </p>
    );
  }

  return null;
}

function SelectedToolGroupProviders({
  option,
}: {
  option: SkillToolGroupOption | null;
}) {
  if (!option?.providers?.length) return null;

  return (
    <CapabilityGroupCard.Providers className="mt-2">
      {option.providers.map((provider) => (
        <CapabilityGroupCard.ProviderBadge
          key={provider.providerName}
          name={provider.providerName}
          toolsNumber={provider.itemCount}
        />
      ))}
    </CapabilityGroupCard.Providers>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[var(--component-colours-color-fg-danger-primary)]">
      {children}
    </p>
  );
}
