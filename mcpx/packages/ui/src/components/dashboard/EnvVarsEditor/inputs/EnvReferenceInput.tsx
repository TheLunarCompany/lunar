import { useEffect, useMemo, useRef, useState } from "react";

import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription } from "@/components/ui/field";
import {
  ComboboxItemCreatable,
  CreatableCombobox,
  isCreatableItem,
} from "@/components/ui/creatable-combobox";

import {
  buildReferenceOptions,
  type ReferenceOption,
  resolveReferenceValue,
} from "../utils/referenceOptions";
import type { EnvReferenceInputProps } from "@mcpx/toolkit-ui/src/utils/env-vars-utils";

type UserEnvReferenceInputProps = EnvReferenceInputProps & {
  onDraftValidationChange?: (hasError: boolean) => void;
};

export const EnvReferenceInput = ({
  value,
  onChange,
  disabled,
  secrets,
  isLoading,
  onDraftValidationChange,
}: UserEnvReferenceInputProps) => {
  const [query, setQuery] = useState(value);
  const [selectedValue, setSelectedValue] = useState<ReferenceOption | null>(
    null,
  );
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Render the popup inside the surrounding sheet/dialog to avoid layering and
  // positioning issues when this field is used in overlays.
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  useEffect(() => {
    setQuery(value);
    setSelectedValue(null);
  }, [value]);

  useEffect(() => {
    if (!anchorRef.current) {
      return;
    }

    const container = anchorRef.current.closest(
      '[data-slot="sheet-content"], [data-slot="dialog-content"]',
    );

    if (container instanceof HTMLElement) {
      setPortalContainer(container);
    }
  }, []);

  const options = useMemo(
    () => buildReferenceOptions(query, secrets),
    [query, secrets],
  );
  const trimmedQuery = query.trim();
  const hasUnappliedDraft = trimmedQuery !== "" && trimmedQuery !== value;

  useEffect(() => {
    onDraftValidationChange?.(hasUnappliedDraft);
  }, [hasUnappliedDraft, onDraftValidationChange]);

  const handleReferenceValue = (nextValue: string) => {
    setQuery(nextValue);
    const resolved = resolveReferenceValue(nextValue, secrets);
    onChange(resolved.mode, nextValue);

    // Selecting/creating an item can leave focus on the popup interaction
    // target. Restore focus and caret position so the field remains editable.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextValue.length, nextValue.length);
    });
  };

  return (
    <Field className="gap-1 min-w-0 flex-1">
      <CreatableCombobox
        items={options}
        inputValue={query}
        value={selectedValue}
        openOnInputClick
        itemToStringLabel={(item) => (item as ReferenceOption).label}
        onQueryChange={(nextQuery) => {
          setQuery(nextQuery);
          setSelectedValue(null);

          if (nextQuery === "" && value !== "") {
            onChange("fromEnv", "");
          }
        }}
        onValueChange={(nextValue) => {
          if (
            !nextValue ||
            Array.isArray(nextValue) ||
            typeof nextValue !== "object" ||
            !("value" in nextValue) ||
            typeof nextValue.value !== "string"
          ) {
            return;
          }

          setSelectedValue(null);
          handleReferenceValue(nextValue.value);
        }}
        onCreateValue={(nextValue) => {
          handleReferenceValue(nextValue);
        }}
        createLabel={(nextValue) => `Use env var "${nextValue}"`}
      >
        <div ref={anchorRef} className="flex-1 min-w-0">
          <ComboboxInput
            ref={inputRef}
            aria-label="Environment variable or secret reference"
            disabled={disabled || isLoading}
            placeholder={
              isLoading
                ? "Loading references..."
                : "Search or create a reference"
            }
            className="w-full"
            showClear={query !== ""}
          />
        </div>
        <ComboboxContent
          anchor={anchorRef}
          container={portalContainer}
          initialFocus={false}
        >
          <ComboboxEmpty>
            <div className="px-2 py-2 text-sm text-muted-foreground">
              No secrets found.
            </div>
          </ComboboxEmpty>
          <ComboboxList>
            {(item) =>
              isCreatableItem(item) ? (
                <ComboboxItemCreatable
                  value={item}
                  onMouseDown={(event) => {
                    // Prevent the input from blurring before the combobox
                    // selection logic runs. Without this, click selection can
                    // become unreliable inside the editor popover.
                    event.preventDefault();
                  }}
                />
              ) : (
                <ComboboxItem
                  key={(item as ReferenceOption).key}
                  value={item}
                  onMouseDown={(event) => {
                    // Prevent the input from blurring before the combobox
                    // selection logic runs. Without this, click selection can
                    // become unreliable inside the editor popover.
                    event.preventDefault();
                  }}
                >
                  <span className="truncate">
                    {(item as ReferenceOption).label}
                  </span>
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </CreatableCombobox>
      <FieldDescription className="text-[10px] font-medium text-red-500 mt-1">
        {hasUnappliedDraft ? (
          <>Click '+ Use env var "{trimmedQuery}"' to apply this value</>
        ) : null}
      </FieldDescription>
    </Field>
  );
};
