import { Button, buttonVariants } from "@/components/ui/button";
import { Sort } from "@/components/Sort";
import { MultiSelectFilterDropdown } from "@/components/ui/multi-select-filter-dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { toast } from "@/components/ui/use-toast";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useDeleteSkill, useEnabledSkills, useSkills } from "@/data/skills";
import { useDomainIcon } from "@/hooks/useDomainIcon";
import { buildSkillAgentSelection } from "@/mapping/skill-agents";
import {
  buildSkillCardCapabilitySummaryResolver,
  buildSkillFilterOptions,
  matchesSkillFilter,
} from "@/mapping/skills";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";
import { ListFilter, Plus, ServerIcon, X } from "lucide-react";
import { parseAsNativeArrayOf, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SkillCard } from "./SkillCard";
import { SkillAgentIcon } from "./SkillAgentIcon";
import * as SkillPage from "./SkillPage";

const SORT_VALUES = {
  updatedAsc: "updated-asc",
  updatedDesc: "updated-desc",
  nameAsc: "name-asc",
  nameDesc: "name-desc",
} as const;

type SortValue = (typeof SORT_VALUES)[keyof typeof SORT_VALUES];

const SORT_OPTIONS: Array<{
  label: string;
  value: SortValue;
}> = [
  { label: "Oldest updated", value: SORT_VALUES.updatedAsc },
  { label: "Newest updated", value: SORT_VALUES.updatedDesc },
  { label: "A to Z", value: SORT_VALUES.nameAsc },
  { label: "Z to A", value: SORT_VALUES.nameDesc },
];

function SkillServerFilterOption({ name }: { name: string }) {
  const iconUrl = useDomainIcon(name);

  return (
    <>
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          aria-hidden="true"
          className="size-4 shrink-0 rounded object-contain"
        />
      ) : (
        <ServerIcon className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{name}</span>
    </>
  );
}

export function SkillsGrid() {
  const navigate = useNavigate();
  const skills = useSkills();
  const enabledSkills = useEnabledSkills();
  const catalogServers = useGetMCPServers();
  const deleteSkill = useDeleteSkill();
  const systemState = useSocketStore((s) => s.systemState);

  const [query, setQuery] = useQueryState("q", { defaultValue: "" });
  const [sortValue, setSortValue] = useQueryState("sort", {
    defaultValue: SORT_VALUES.updatedAsc,
  });
  const [selectedAgents, setSelectedAgents] = useQueryState(
    "agents",
    parseAsNativeArrayOf(parseAsString).withDefault([]),
  );
  const [selectedServers, setSelectedServers] = useQueryState(
    "servers",
    parseAsNativeArrayOf(parseAsString).withDefault([]),
  );

  const all = useMemo(() => skills.data ?? [], [skills.data]);

  const summarizeSkillCapabilities = useMemo(
    () =>
      buildSkillCardCapabilitySummaryResolver(systemState, catalogServers.data),
    [catalogServers.data, systemState],
  );

  const allCards = useMemo(
    () =>
      all.map((skill) => ({
        skill,
        capabilitySummary: summarizeSkillCapabilities(skill.capabilityGroup),
        agents: buildSkillAgentSelection({
          clusters: systemState?.connectedClientClusters ?? [],
          enabled: enabledSkills.data ?? [],
          skillId: skill.id,
        }).selected.map((subject) => subject.value),
      })),
    [all, enabledSkills.data, summarizeSkillCapabilities, systemState],
  );

  const agentOptions = useMemo(
    () => buildSkillFilterOptions(allCards.flatMap(({ agents }) => agents)),
    [allCards],
  );
  const serverOptions = useMemo(
    () =>
      buildSkillFilterOptions(
        allCards.flatMap(
          ({ capabilitySummary }) => capabilitySummary.providers,
        ),
      ),
    [allCards],
  );

  const visibleCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allCards
      .filter(({ skill, agents, capabilitySummary }) => {
        const matchesSearch =
          !normalized ||
          skill.name.toLowerCase().includes(normalized) ||
          skill.description.toLowerCase().includes(normalized);
        return (
          matchesSearch &&
          matchesSkillFilter(agents, selectedAgents) &&
          matchesSkillFilter(capabilitySummary.providers, selectedServers)
        );
      })
      .sort((a, b) => {
        const nameComparison = a.skill.name.localeCompare(
          b.skill.name,
          undefined,
          { sensitivity: "base" },
        );

        switch (sortValue) {
          case SORT_VALUES.nameAsc:
            return nameComparison;
          case SORT_VALUES.nameDesc:
            return -nameComparison;
          case SORT_VALUES.updatedDesc:
            return (
              b.skill.updatedAt.getTime() - a.skill.updatedAt.getTime() ||
              nameComparison
            );
          case SORT_VALUES.updatedAsc:
          default:
            return (
              a.skill.updatedAt.getTime() - b.skill.updatedAt.getTime() ||
              nameComparison
            );
        }
      });
  }, [allCards, query, selectedAgents, selectedServers, sortValue]);

  const isFiltered =
    query.trim().length > 0 ||
    selectedAgents.length > 0 ||
    selectedServers.length > 0;

  function resetFilters() {
    setQuery("");
    setSelectedAgents([]);
    setSelectedServers([]);
  }

  async function handleDelete(id: string) {
    try {
      await deleteSkill.mutateAsync(id);
    } catch (error) {
      toast({
        title: "Failed to delete skill",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <SkillPage.Root overflow="hidden">
      <SkillPage.Container size="full">
        <SkillPage.Header className="mb-5">
          <SkillPage.HeaderText>
            <SkillPage.Title>Skills</SkillPage.Title>
            <SkillPage.Description>
              Reusable bundles of a <strong>SKILL.md</strong> guide plus the
              tools & prompts an agent needs to follow it. Adopt a skill, then
              apply it to your agents.
            </SkillPage.Description>
          </SkillPage.HeaderText>
        </SkillPage.Header>
        <SkillPage.Toolbar>
          <SearchInput
            aria-label="Search skills"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            wrapperClassName="w-full sm:w-40 md:w-48 lg:w-[280px]"
            className="h-9 rounded-lg border-[var(--structure-color-border-primary)] bg-background"
          />
          <Sort
            title="Sort"
            options={SORT_OPTIONS}
            selected={sortValue as SortValue}
            onChange={setSortValue}
          />
          <MultiSelectFilterDropdown
            options={agentOptions}
            getOptionValue={(option) => option.value}
            renderOption={(option) => (
              <>
                <SkillAgentIcon name={option.label} className="size-4" />
                <span className="truncate">{option.label}</span>
              </>
            )}
            selectedValues={selectedAgents}
            onSelectedValuesChange={(values) => setSelectedAgents(values)}
            allLabel="All agents"
            searchPlaceholder="Search agents..."
            triggerLabel="Filter by agents"
            triggerClassName={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "h-9",
            })}
            triggerContent={
              <>
                <ListFilter className="mr-2 size-4" />
                Agents
                {selectedAgents.length > 0 ? (
                  <span className="ml-1.5 text-xs text-[var(--colors-gray-500)]">
                    ({selectedAgents.length})
                  </span>
                ) : null}
              </>
            }
          />
          <MultiSelectFilterDropdown
            options={serverOptions}
            getOptionValue={(option) => option.value}
            renderOption={(option) => (
              <SkillServerFilterOption name={option.label} />
            )}
            selectedValues={selectedServers}
            onSelectedValuesChange={(values) => setSelectedServers(values)}
            allLabel="All MCP servers"
            searchPlaceholder="Search MCP servers..."
            triggerLabel="Filter by MCP servers"
            triggerClassName={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "h-9",
            })}
            triggerContent={
              <>
                <ListFilter className="mr-2 size-4" />
                MCP servers
                {selectedServers.length > 0 ? (
                  <span className="ml-1.5 text-xs text-[var(--colors-gray-500)]">
                    ({selectedServers.length})
                  </span>
                ) : null}
              </>
            }
          />
          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-2 lg:px-3"
              onClick={resetFilters}
            >
              Reset
              <X />
            </Button>
          )}
          <Button
            type="button"
            className="w-full sm:ml-auto sm:w-auto"
            onClick={() => navigate(routes.skillNew)}
          >
            <Plus />
            Create skill
          </Button>
        </SkillPage.Toolbar>

        <SkillPage.Content className="min-h-0 min-w-0 flex-1 overflow-y-auto pt-2">
          {skills.isLoading ? (
            <SkillPage.Message title="Loading skills..." />
          ) : skills.isError ? (
            <SkillPage.Message
              title={
                skills.error instanceof Error
                  ? skills.error.message
                  : "Failed to load skills"
              }
            />
          ) : (skills.data ?? []).length === 0 ? (
            <SkillPage.Message title="No skills yet">
              <Button type="button" onClick={() => navigate(routes.skillNew)}>
                <Plus />
                Create skill
              </Button>
            </SkillPage.Message>
          ) : visibleCards.length === 0 ? (
            <SkillPage.Message title="No skills match your filters." />
          ) : (
            <div className="grid min-w-0 grid-cols-1 content-start gap-4 pb-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleCards.map(({ skill, capabilitySummary, agents }) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  providers={capabilitySummary.providers}
                  agents={agents}
                  toolsCount={capabilitySummary.toolsCount}
                  promptsCount={capabilitySummary.promptsCount}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </SkillPage.Content>
      </SkillPage.Container>
    </SkillPage.Root>
  );
}
