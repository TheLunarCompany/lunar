import { buildCapabilityProvidersFromCurrentTools } from "@/components/capabilities/current-tool-capabilities";
import type { CapabilityProvider } from "@/components/capabilities/types";
import { SkillBreadcrumbTrail, SkillPage } from "@/components/skills";
import { SkillCapabilityPickerField } from "@/components/skills/SkillCapabilityPickerField";
import { getSkillBreadcrumbs } from "@/components/skills/skill-breadcrumbs";
import { SkillLinkedCapabilitiesCard } from "@/components/skills/SkillLinkedCapabilitiesCard";
import {
  sortSkillCapabilityKeys,
  skillCapabilityDraftToFormValues,
  skillCapabilityFormValuesToGroup,
  type SkillCapabilityFormValues,
} from "@/components/skills/skill-capability-form-schema";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useSkill, useUpdateSkillCapabilities } from "@/data/skills";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import {
  addUnavailableSavedSkillCapabilities,
  buildLinkedCapabilityProviders,
  getCapabilityProviderSelectionId,
  splitSkillCapabilitySelectionKey,
} from "@/mapping/skill-capabilities";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";
import { Loader2 } from "lucide-react";
import { parseAsNativeArrayOf, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";
import {
  useForm,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

export default function SkillCapabilitiesEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [providerFilters, setProviderFilters] = useQueryState(
    "mcp",
    parseAsNativeArrayOf(parseAsString).withDefault([]),
  );
  const { appConfig, systemState } = useSocketStore((state) => ({
    appConfig: state.appConfig,
    systemState: state.systemState,
  }));
  const skillQuery = useSkill(id ?? "");
  const catalogServersQuery = useGetMCPServers();
  const updateSkillCapabilities = useUpdateSkillCapabilities();
  const targetServers = useMemo(
    () => systemState?.targetServers ?? [],
    [systemState?.targetServers],
  );
  const capabilityProviders = useMemo(
    () =>
      buildCapabilityProvidersFromCurrentTools({
        targetServers,
        toolExtensionsServices: appConfig?.toolExtensions?.services,
      }),
    [appConfig?.toolExtensions?.services, targetServers],
  );
  const unavailableProviderNames = useMemo(
    () =>
      new Set(
        targetServers
          .filter((server) => !server.catalogItemId)
          .map((server) => server.name),
      ),
    [targetServers],
  );
  const selectableCapabilityProviders = useMemo(
    () =>
      addUnavailableSavedSkillCapabilities({
        capabilityGroup: skillQuery.data?.capabilityGroup,
        targetServers,
        providers: capabilityProviders,
        catalogItems: catalogServersQuery.data,
      }),
    [
      capabilityProviders,
      catalogServersQuery.data,
      skillQuery.data?.capabilityGroup,
      targetServers,
    ],
  );
  const defaultValues = useMemo(
    () =>
      skillCapabilityDraftToFormValues({
        capabilityGroup: skillQuery.data?.capabilityGroup,
        providers: selectableCapabilityProviders,
      }),
    [selectableCapabilityProviders, skillQuery.data?.capabilityGroup],
  );
  const form = useForm<SkillCapabilityFormValues>({
    defaultValues,
  });
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isDirty },
  } = form;
  const isSubmitting = updateSkillCapabilities.isPending;
  useUnsavedChangesPrompt(isDirty);

  const activeProviderFilters = useMemo(() => {
    const providerNames = new Set(
      selectableCapabilityProviders.map((provider) => provider.name),
    );

    return providerFilters.filter((providerName) =>
      providerNames.has(providerName),
    );
  }, [providerFilters, selectableCapabilityProviders]);

  useEffect(() => {
    if (!isDirty) {
      reset(defaultValues);
    }
  }, [defaultValues, isDirty, reset]);

  useEffect(() => {
    if (
      providerFilters.length > 0 &&
      skillQuery.data &&
      selectableCapabilityProviders.length > 0 &&
      activeProviderFilters.length !== providerFilters.length
    ) {
      void setProviderFilters(
        activeProviderFilters.length > 0 ? activeProviderFilters : null,
      );
    }
  }, [
    activeProviderFilters,
    providerFilters,
    selectableCapabilityProviders.length,
    setProviderFilters,
    skillQuery.data,
  ]);

  const submit = handleSubmit(async (values) => {
    if (!id || !skillQuery.data) {
      return;
    }

    const capabilityGroup = skillCapabilityFormValuesToGroup({
      values,
      providers: selectableCapabilityProviders,
    });

    try {
      const updatedSkill = await updateSkillCapabilities.mutateAsync({
        id,
        capabilityGroup: capabilityGroup ?? null,
      });
      reset(
        skillCapabilityDraftToFormValues({
          capabilityGroup: updatedSkill?.capabilityGroup ?? capabilityGroup,
          providers: selectableCapabilityProviders,
        }),
      );
      toast({
        title: "Skill capabilities updated",
        description: "MCP capabilities were saved for this skill.",
      });
    } catch (error) {
      toast({
        title: "Failed to update skill capabilities",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  });

  return (
    <SkillPage.Root>
      <SkillPage.Container size="wide">
        <SkillPage.Header>
          <SkillPage.HeaderText>
            <SkillPage.Breadcrumbs>
              <SkillBreadcrumbTrail
                items={getSkillBreadcrumbs({
                  id,
                  skillName: skillQuery.data?.name,
                  current: "MCP capabilities",
                })}
              />
            </SkillPage.Breadcrumbs>
            <SkillPage.Title>MCP capabilities</SkillPage.Title>
            <SkillPage.Description>
              Select the MCP tools and prompts this skill can use.
            </SkillPage.Description>
          </SkillPage.HeaderText>
          <SkillPage.Actions>
            <SaveCapabilitiesButton
              form="skill-capabilities-form"
              isSubmitting={isSubmitting}
              disabled={!isDirty}
            />
          </SkillPage.Actions>
        </SkillPage.Header>

        {skillQuery.isLoading ? (
          <EditorMessage title="Loading skill..." />
        ) : skillQuery.isError || !skillQuery.data ? (
          <EditorMessage title="Skill not found.">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(routes.skills)}
            >
              Back to skills
            </Button>
          </EditorMessage>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <form
              id="skill-capabilities-form"
              onSubmit={submit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <section className="min-h-0 flex-1 overflow-auto pb-5">
                <SkillCapabilitiesSelectionContent
                  control={control}
                  setValue={setValue}
                  providers={selectableCapabilityProviders}
                  unavailableProviderNames={unavailableProviderNames}
                  providerFilters={activeProviderFilters}
                  onProviderFiltersChange={(providerNames) =>
                    void setProviderFilters(
                      providerNames.length > 0 ? providerNames : null,
                    )
                  }
                />
              </section>
              <div className="flex shrink-0 justify-end gap-2 px-5 py-4">
                <SaveCapabilitiesButton
                  isSubmitting={isSubmitting}
                  disabled={!isDirty}
                />
              </div>
            </form>
          </div>
        )}
      </SkillPage.Container>
    </SkillPage.Root>
  );
}

function SaveCapabilitiesButton({
  form,
  isSubmitting,
  disabled,
}: {
  form?: string;
  isSubmitting: boolean;
  disabled: boolean;
}) {
  return (
    <Button type="submit" form={form} disabled={isSubmitting || disabled}>
      {isSubmitting ? <Loader2 className="animate-spin" /> : null}
      Save capabilities
    </Button>
  );
}

function SkillCapabilitiesSelectionContent({
  control,
  setValue,
  providers,
  unavailableProviderNames,
  providerFilters,
  onProviderFiltersChange,
}: {
  control: Control<SkillCapabilityFormValues>;
  setValue: UseFormSetValue<SkillCapabilityFormValues>;
  providers: CapabilityProvider[];
  unavailableProviderNames: Set<string>;
  providerFilters: string[];
  onProviderFiltersChange: (providerNames: string[]) => void;
}) {
  const capabilitiesValue = useWatch({
    control,
    name: "capabilities",
    defaultValue: { selectedKeys: [] },
  });
  const selectedKeys = useMemo(
    () => new Set(capabilitiesValue.selectedKeys),
    [capabilitiesValue.selectedKeys],
  );
  const linkedProviders = useMemo(
    () => buildLinkedCapabilityProviders({ providers, selectedKeys }),
    [providers, selectedKeys],
  );

  function unlinkProvider(provider: CapabilityProvider) {
    const providerSelectionId = getCapabilityProviderSelectionId(provider);
    const nextSelectedKeys = capabilitiesValue.selectedKeys.filter(
      (key) =>
        splitSkillCapabilitySelectionKey(key).catalogItemId !==
        providerSelectionId,
    );

    setValue(
      "capabilities",
      {
        ...capabilitiesValue,
        selectedKeys: sortSkillCapabilityKeys(nextSelectedKeys),
      },
      { shouldDirty: true, shouldTouch: true },
    );

    if (providerFilters.includes(provider.name)) {
      onProviderFiltersChange(
        providerFilters.filter(
          (providerName) => providerName !== provider.name,
        ),
      );
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
        <SkillLinkedCapabilitiesCard
          providers={linkedProviders}
          activeProviderNames={providerFilters}
          onProviderClick={(provider) =>
            onProviderFiltersChange([provider.name])
          }
          onProviderUnlink={unlinkProvider}
        />
      </div>
      <SkillCapabilityPickerField
        control={control}
        name="capabilities"
        providers={providers}
        unavailableProviderNames={unavailableProviderNames}
        providerFilters={providerFilters}
        onProviderFiltersChange={onProviderFiltersChange}
      />
    </div>
  );
}

function EditorMessage({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid flex-1 place-items-center gap-4 p-5 text-sm text-[var(--text-colours-color-text-secondary)]">
      <span>{title}</span>
      {children}
    </div>
  );
}
