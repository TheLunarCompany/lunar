import { useGetMCPServers } from "./catalog-servers";
import { useEnabledSkills, useSkills } from "./skills";

const EMPTY_RESULTS: never[] = [];

export function useAgentDrawerSkillsData({ enabled }: { enabled: boolean }) {
  const skillsQuery = useSkills({ enabled });
  const enabledSkillsQuery = useEnabledSkills({ enabled });
  const catalogServersQuery = useGetMCPServers({ enabled });

  return {
    skills: skillsQuery.data ?? EMPTY_RESULTS,
    enabledSkills: enabledSkillsQuery.data ?? EMPTY_RESULTS,
    catalogItems: catalogServersQuery.data ?? EMPTY_RESULTS,
    isLoading: skillsQuery.isLoading || enabledSkillsQuery.isLoading,
    isError: skillsQuery.isError || enabledSkillsQuery.isError,
  };
}
