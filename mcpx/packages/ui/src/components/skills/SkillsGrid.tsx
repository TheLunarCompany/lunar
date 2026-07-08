import { Button } from "@/components/ui/button";
import { Sort } from "@/components/Sort";
import { SearchInput } from "@/components/ui/search-input";
import { toast } from "@/components/ui/use-toast";
import { useDeleteSkill, useSkills } from "@/data/skills";
import { buildSkillProviderNameResolver } from "@/mapping/skills";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";
import { Plus, X } from "lucide-react";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SkillCard } from "./SkillCard";
import * as SkillPage from "./SkillPage";

const SORT_ORDERS = {
  asc: "asc",
  desc: "desc",
} as const;

type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS];

const SORT_OPTIONS: Array<{
  label: string;
  value: SortOrder;
}> = [
  { label: "A to Z", value: SORT_ORDERS.asc },
  { label: "Z to A", value: SORT_ORDERS.desc },
];

export function SkillsGrid() {
  const navigate = useNavigate();
  const skills = useSkills();
  const deleteSkill = useDeleteSkill();
  const systemState = useSocketStore((s) => s.systemState);

  const [query, setQuery] = useQueryState("q", { defaultValue: "" });
  const [sortOrder, setSortOrder] = useQueryState("sort", {
    defaultValue: SORT_ORDERS.asc,
  });

  const all = useMemo(() => skills.data ?? [], [skills.data]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...all]
      .filter((skill) => {
        const matchesSearch =
          !normalized ||
          skill.name.toLowerCase().includes(normalized) ||
          skill.description.toLowerCase().includes(normalized);
        return matchesSearch;
      })
      .sort((a, b) => {
        const direction = sortOrder === SORT_ORDERS.desc ? -1 : 1;
        return (
          direction *
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
      });
  }, [all, query, sortOrder]);

  const resolveProviderNames = useMemo(
    () => buildSkillProviderNameResolver(systemState),
    [systemState],
  );

  const visibleCards = useMemo(
    () =>
      visible.map((skill) => ({
        skill,
        providers: resolveProviderNames(skill.capabilityGroup),
      })),
    [resolveProviderNames, visible],
  );

  const isFiltered = query.trim().length > 0;

  function resetFilters() {
    setQuery("");
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
            wrapperClassName="w-full sm:w-[280px]"
            className="h-9 rounded-lg border-[var(--structure-color-border-primary)] bg-background"
          />
          <Sort
            title="Sort"
            options={SORT_OPTIONS}
            selected={sortOrder as SortOrder}
            onChange={setSortOrder}
          />
          {/* <SkillsFacetedFilter
            title="Type"
            options={TYPE_OPTIONS}
            selected={types}
            facets={facets.type}
            onChange={setTypes}
          />
          <SkillsFacetedFilter
            title="Tools"
            options={TOOLS_OPTIONS}
            selected={tools}
            facets={facets.tools}
            onChange={setTools}
          /> */}
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
            className="sm:ml-auto"
            onClick={() => navigate(routes.skillNew)}
          >
            <Plus />
            Create skill
          </Button>
        </SkillPage.Toolbar>

        <SkillPage.Content className="min-h-0 flex-1 overflow-y-auto pt-2">
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
          ) : visible.length === 0 ? (
            <SkillPage.Message title="No skills match your filters." />
          ) : (
            <div className="grid grid-cols-1 content-start gap-4 pb-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleCards.map(({ skill, providers }) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  providers={providers}
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
