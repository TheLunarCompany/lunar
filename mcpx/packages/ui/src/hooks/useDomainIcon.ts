import { useMemo } from "react";

const serverNameIcons = new Set([
  "airtable",
  "appDynamics",
  "asana",
  "atlassian",
  "aws",
  "azureDevOps",
  "basecamp",
  "bitbucket",
  "blueJeans",
  "brave",
  "circleCI",
  "clickUp",
  "context7",
  "copper",
  "datadog",
  "discord",
  "docker",
  "elastic",
  "freshsales",
  "gitHub",
  "gitLab",
  "goToMeeting",
  "googleMeet",
  "grafana",
  "hashicorpVault",
  "honeycomb",
  "hubspot",
  "insightly",
  "jenkins",
  "jira",
  "kubernetes",
  "launchdarkly",
  "linear",
  "loadmill",
  "microsoftDynamics",
  "microsoftTeams",
  "monday",
  "newRelic",
  "notion",
  "pipedrive",
  "playwright",
  "postgres",
  "prometheus",
  "redis",
  "ringCentral",
  "rollbar",
  "salesforce",
  "sentry",
  "slack",
  "smartsheet",
  "snowflake",
  "sourceForge",
  "splunk",
  "sugarCRM",
  "terraform",
  "travisCI",
  "trello",
  "webex",
  "wrike",
  "zoho",
  "zoom",
]);

export function getIconKey(name: string): string | null {
  // search for exact match O(1)
  if (serverNameIcons.has(name)) return name;

  // search for the lower version of the name in O(1)
  const lowerName = name.toLowerCase();
  if (serverNameIcons.has(lowerName)) return lowerName;

  // didn't found the original or lower version - lower also the keys and search the set
  for (const key of serverNameIcons) {
    if (key.toLowerCase() === lowerName) return key;
  }

  // handle partial matches (e.g., "brave-search" -> "brave", "aws-docs" -> "aws")
  for (const key of serverNameIcons) {
    const lowerKey = key.toLowerCase();
    if (
      lowerName.startsWith(lowerKey + "-") ||
      lowerName.startsWith(lowerKey + "_")
    ) {
      return key;
    }
  }

  // no match at all - return null
  return null;
}

export const useDomainIcon = (name: string | null) => {
  const iconUrl = useMemo(() => {
    if (!name) return "";

    const domainKey = getIconKey(name);

    if (!domainKey) {
      return "";
    }

    return `/icons/${domainKey}.png`;
  }, [name]);

  return iconUrl;
};
