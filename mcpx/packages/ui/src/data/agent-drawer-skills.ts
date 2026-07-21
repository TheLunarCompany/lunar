import { useGetMCPServers } from "./catalog-servers";
import { useEnabledSkills, useSkills } from "./skills";

export function useAgentDrawerSkillsData({ enabled }: { enabled: boolean }) {
  const skillsQuery = useSkills({ enabled });
  const enabledSkillsQuery = useEnabledSkills({ enabled });
  const catalogServersQuery = useGetMCPServers({ enabled });

  return {
    skills: skillsQuery.data ?? [],
    enabledSkills: enabledSkillsQuery.data ?? [],
    catalogItems: catalogServersQuery.data ?? [],
    isLoading: skillsQuery.isLoading || enabledSkillsQuery.isLoading,
    isError: skillsQuery.isError || enabledSkillsQuery.isError,
  };
}
