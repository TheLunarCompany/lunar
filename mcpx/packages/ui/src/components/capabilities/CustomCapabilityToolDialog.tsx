import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { useEffect, useMemo, useState } from "react";
import type { CapabilityItem, CapabilityProvider } from "./types";

export type CustomCapabilityToolSubmitPayload = {
  providerName: string;
  baseCapabilityName: string;
  customCapabilityName: string;
  description: string;
  parameters: Array<{ name: string; description: string; value: string }>;
  originalCustomCapabilityName?: string;
};

type CustomCapabilityToolDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  providers: CapabilityProvider[];
  preSelectedProviderName?: string;
  preSelectedItemName?: string;
  preFilledData?: {
    name: string;
    description: string;
    parameters?: Array<{ name: string; description: string; value: string }>;
  };
  isLoading?: boolean;
  onSubmitCustomCapabilityTool: (
    payload: CustomCapabilityToolSubmitPayload,
  ) => void | Promise<void | boolean>;
};

type CustomCapabilityToolParameter = {
  name: string;
  description: string;
  value: string;
  type?: string;
};

function propertiesToParameters(
  item: CapabilityItem | undefined,
): CustomCapabilityToolParameter[] {
  const properties = item?.inputSchema?.properties;
  if (!properties || typeof properties !== "object") {
    return [];
  }

  return Object.entries(properties).map(([name, schema]) => {
    const record =
      typeof schema === "object" && schema !== null
        ? (schema as Record<string, unknown>)
        : {};

    return {
      name,
      description:
        typeof record.description === "string" ? record.description : "",
      value:
        record.default === undefined || record.default === null
          ? ""
          : String(record.default),
      type: typeof record.type === "string" ? record.type : "string",
    };
  });
}

export function CustomCapabilityToolDialog({
  isOpen,
  onOpenChange,
  onClose,
  providers,
  preSelectedProviderName,
  preSelectedItemName,
  preFilledData,
  isLoading = false,
  onSubmitCustomCapabilityTool,
}: CustomCapabilityToolDialogProps) {
  const [providerName, setProviderName] = useState("");
  const [itemName, setItemName] = useState("");
  const [customName, setCustomName] = useState("");
  const [description, setDescription] = useState("");
  const [parameters, setParameters] = useState<CustomCapabilityToolParameter[]>(
    [],
  );
  const [nameError, setNameError] = useState<string | null>(null);

  const provider = useMemo(
    () => providers.find((candidate) => candidate.name === providerName),
    [providerName, providers],
  );
  const item = useMemo(
    () => provider?.items.find((candidate) => candidate.name === itemName),
    [itemName, provider],
  );
  const isEditMode = !!preFilledData;
  const providerIcon = useDomainIcon(providerName);
  const displayProviderName = providerName
    ? providerName.charAt(0).toUpperCase() + providerName.slice(1)
    : "";

  useEffect(() => {
    if (!isOpen) return;

    const nextProviderName =
      preSelectedProviderName ?? providers[0]?.name ?? "";
    const nextProvider = providers.find(
      (candidate) => candidate.name === nextProviderName,
    );
    const nextItemName =
      preSelectedItemName ?? nextProvider?.items[0]?.name ?? "";
    const nextItem = nextProvider?.items.find(
      (candidate) => candidate.name === nextItemName,
    );

    setProviderName(nextProviderName);
    setItemName(nextItemName);
    setCustomName(preFilledData?.name ?? `Custom_${nextItemName}`);
    setDescription(preFilledData?.description ?? nextItem?.description ?? "");
    setParameters(
      preFilledData?.parameters ?? propertiesToParameters(nextItem),
    );
    setNameError(null);
  }, [
    isOpen,
    preFilledData,
    preSelectedItemName,
    preSelectedProviderName,
    providers,
  ]);

  function handleProviderChange(nextProviderName: string) {
    const nextProvider = providers.find(
      (candidate) => candidate.name === nextProviderName,
    );
    const nextItem = nextProvider?.items[0];

    setProviderName(nextProviderName);
    setItemName(nextItem?.name ?? "");
    setDescription(nextItem?.description ?? "");
    setParameters(propertiesToParameters(nextItem));
  }

  function handleItemChange(nextItemName: string) {
    const nextItem = provider?.items.find(
      (candidate) => candidate.name === nextItemName,
    );

    setItemName(nextItemName);
    setDescription(nextItem?.description ?? "");
    setParameters(propertiesToParameters(nextItem));
  }

  async function handleSubmit() {
    const submittedCustomName = isEditMode
      ? (preFilledData?.name ?? customName).trim()
      : customName.trim();

    if (!submittedCustomName) {
      setNameError("Tool name is required");
      return;
    }

    await onSubmitCustomCapabilityTool({
      providerName,
      baseCapabilityName: itemName,
      customCapabilityName: submittedCustomName,
      originalCustomCapabilityName: preFilledData?.name,
      description,
      parameters: parameters.map(({ name, description, value }) => ({
        name,
        description,
        value,
      })),
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg bg-white p-0 sm:max-w-4xl [&>button]:hidden"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Customize Tool</DialogTitle>
        <div className="border-b border-gray-200 bg-white px-6 py-6">
          <div className="flex items-center justify-between bg-white">
            <h2 className="text-2xl font-semibold">Customize Tool</h2>
            <DialogClose asChild>
              <button
                onClick={onClose}
                className="px-2 py-1 text-2xl leading-none text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ×
              </button>
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">
            Create or edit a custom tool.
          </DialogDescription>
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-3">
              <Spinner />
              <span className="text-sm text-gray-600">
                Saving custom tool...
              </span>
            </div>
          </div>
        )}

        <div className="relative border-b border-gray-200 bg-white">
          <div className="mx-6 flex flex-row items-center justify-between border-b border-gray-200 bg-white py-4">
            <div className="flex items-center gap-3">
              <img
                src={providerIcon}
                alt={`${providerName} icon`}
                className="size-12 rounded-full bg-white object-contain"
              />
              <div className="flex flex-col">
                <h3 className="text-2xl font-semibold">
                  {displayProviderName}
                </h3>
                <span className="text-sm">{itemName}</span>
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto px-6 pb-6">
            {!preSelectedProviderName || !preSelectedItemName ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="custom-capability-provider"
                    className="text-sm font-medium"
                  >
                    Server
                  </label>
                  <select
                    id="custom-capability-provider"
                    value={providerName}
                    onChange={(event) =>
                      handleProviderChange(event.target.value)
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    disabled={!!preSelectedProviderName}
                  >
                    {providers.map((candidate) => (
                      <option key={candidate.name} value={candidate.name}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="custom-capability-base"
                    className="text-sm font-medium"
                  >
                    Tool
                  </label>
                  <select
                    id="custom-capability-base"
                    value={itemName}
                    onChange={(event) => handleItemChange(event.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    disabled={!!preSelectedItemName}
                  >
                    {(provider?.items ?? []).map((candidate) => (
                      <option key={candidate.id} value={candidate.name}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <label
                htmlFor="custom-capability-name"
                className="mb-1 block text-base font-medium text-gray-800"
              >
                Custom tool name
              </label>
              <Input
                id="custom-capability-name"
                value={customName}
                onChange={(event) => {
                  if (isEditMode) {
                    return;
                  }

                  setCustomName(event.target.value);
                  setNameError(null);
                }}
                placeholder="Enter custom tool name"
                className={`w-full border-gray-200 focus-visible:ring-[#4F33CC] ${nameError ? "border-red-500" : ""}`}
                disabled={isEditMode}
              />
              {nameError && (
                <p className="pt-1 text-xs text-destructive">{nameError}</p>
              )}
            </div>

            <div className="mt-4">
              <label
                htmlFor="custom-capability-description"
                className="mb-1 block text-base font-medium text-gray-800"
              >
                Description
              </label>
              <Input
                id="custom-capability-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Enter tool description"
                className="w-full border-gray-200 focus-visible:ring-[#4F33CC]"
              />
            </div>

            <div className="pb-6">
              <h3 className="my-4 text-base font-medium">Parameters</h3>
              <div className="space-y-4 rounded-lg pr-2">
                {parameters.length === 0 ? (
                  <p className="text-sm italic text-gray-500">
                    No parameters found for this tool.
                  </p>
                ) : (
                  parameters.map((parameter, index) => (
                    <div
                      key={parameter.name}
                      className="rounded-lg border border-gray-200 bg-[#F9F8FB] pb-4"
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="text-base font-semibold text-[#1D1B4B]">
                          {parameter.name}
                        </div>
                        <span className="rounded-sm bg-[#E5E3EF] px-1 py-1 text-[11px] font-medium text-[#1D1B4B]">
                          {parameter.type || "string"}
                        </span>
                      </div>
                      <div className="relative space-y-3 px-4 pb-4">
                        <div className={parameter.type ? "pt-8" : "pt-0"}>
                          <label className="mb-2 block text-xs font-medium">
                            Value
                          </label>
                          <Input
                            value={parameter.value}
                            onChange={(event) => {
                              const nextParameters = [...parameters];
                              nextParameters[index] = {
                                ...parameter,
                                value: event.target.value,
                              };
                              setParameters(nextParameters);
                            }}
                            placeholder="Enter value"
                            className="w-full border-gray-200 focus-visible:ring-[#4F33CC]"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-medium">
                            Description
                          </label>
                          <Input
                            value={parameter.description}
                            onChange={(event) => {
                              const nextParameters = [...parameters];
                              nextParameters[index] = {
                                ...parameter,
                                description: event.target.value,
                              };
                              setParameters(nextParameters);
                            }}
                            placeholder="Enter parameter description"
                            className="w-full border-gray-200 focus-visible:ring-[#4F33CC]"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-row items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
          <div
            onClick={onClose}
            className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-[#5147E4]"
          >
            Cancel
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !item}
            className="px-6 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-white" />
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
