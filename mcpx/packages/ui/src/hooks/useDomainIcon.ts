import { useMemo } from "react";

const ICONIFY_BASE = "https://api.iconify.design";

type IconConfig = { icon: string; color?: string };

/**
 * Icon sources:
 *
 * - Iconify (preferred): use "logos:<id>" for full-color brand icons,
 *   or "simple-icons:<id>" with a `color` for monochrome icons.
 *   Browse available icons at https://icon-sets.iconify.design/
 *
 * - Local fallback: use "local:<filename>" to serve from /public/icons/<filename>.png.
 *   Use this when the brand icon isn't available on Iconify or the Iconify version
 *   doesn't match the real logo (e.g. missing gradients).
 */
const serverIconConfigs: Record<string, IconConfig> = {
  airtable: { icon: "logos:airtable" },
  appDynamics: { icon: "logos:appdynamics" },
  asana: { icon: "logos:asana-icon" },
  atlassian: { icon: "logos:atlassian" },
  aws: { icon: "logos:aws" },
  azureDevOps: { icon: "simple-icons:azuredevops", color: "#0078D7" },
  basecamp: { icon: "logos:basecamp" },
  bitbucket: { icon: "logos:bitbucket" },
  brave: { icon: "logos:brave" },
  circleCI: { icon: "logos:circleci" },
  clickUp: { icon: "local:clickUp" },
  cloudflare: { icon: "logos:cloudflare-icon" },
  coda: { icon: "logos:coda-icon" },
  context7: { icon: "local:context7" },
  datadog: { icon: "logos:datadog" },
  discord: { icon: "logos:discord-icon" },
  docker: { icon: "logos:docker-icon" },
  elastic: { icon: "logos:elasticsearch" },
  figma: { icon: "logos:figma" },
  gitHub: { icon: "logos:github-icon" },
  gitLab: { icon: "logos:gitlab-icon" },
  goToMeeting: { icon: "simple-icons:gotomeeting", color: "#F68D2E" },
  googleMeet: { icon: "logos:google-meet" },
  grafana: { icon: "logos:grafana" },
  hashicorpVault: { icon: "logos:hashicorp" },
  hubspot: { icon: "logos:hubspot" },
  jenkins: { icon: "logos:jenkins" },
  jira: { icon: "logos:jira" },
  kubernetes: { icon: "logos:kubernetes" },
  launchdarkly: { icon: "logos:launchdarkly-icon" },
  linear: { icon: "local:linear" },
  loadmill: { icon: "local:loadmill" },
  microsoftDynamics: { icon: "simple-icons:dynamics365", color: "#0B53CE" },
  microsoftTeams: { icon: "logos:microsoft-teams" },
  monday: { icon: "logos:monday-icon" },
  newRelic: { icon: "logos:new-relic-icon" },
  notion: { icon: "logos:notion-icon" },
  n8n: { icon: "simple-icons:n8n", color: "#EA4B71" },
  pipedrive: { icon: "logos:pipedrive" },
  playwright: { icon: "logos:playwright" },
  postgres: { icon: "logos:postgresql" },
  prometheus: { icon: "logos:prometheus" },
  redis: { icon: "logos:redis" },
  rollbar: { icon: "simple-icons:rollbar", color: "#EC4A28" },
  salesforce: { icon: "logos:salesforce" },
  sentry: { icon: "logos:sentry-icon" },
  slack: { icon: "logos:slack-icon" },
  snowflake: { icon: "logos:snowflake-icon" },
  sourceForge: { icon: "simple-icons:sourceforge", color: "#FF6600" },
  splunk: { icon: "logos:splunk" },
  terraform: { icon: "logos:terraform-icon" },
  travisCI: { icon: "simple-icons:travisci", color: "#3EAAAF" },
  trello: { icon: "logos:trello" },
  webex: { icon: "simple-icons:webex" },
  zoho: { icon: "simple-icons:zoho", color: "#E42527" },
  zoom: { icon: "logos:zoom-icon" },
};

function getIconUrl(config: IconConfig): string {
  const [prefix, id] = config.icon.split(":");
  if (!prefix || !id) return "";
  if (prefix === "local") return `/icons/${id}.png`;
  const url = `${ICONIFY_BASE}/${prefix}/${id}.svg`;
  return config.color
    ? `${url}?color=${encodeURIComponent(config.color)}`
    : url;
}

export function getIconKey(name: string): string | null {
  if (name in serverIconConfigs) return name;

  const lowerName = name.toLowerCase();
  for (const key of Object.keys(serverIconConfigs)) {
    if (key.toLowerCase() === lowerName) return key;
  }

  for (const key of Object.keys(serverIconConfigs)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerName.startsWith(lowerKey + "-") ||
      lowerName.startsWith(lowerKey + "_")
    ) {
      return key;
    }
  }

  return null;
}

export const useDomainIcon = (name: string | null) => {
  const iconUrl = useMemo(() => {
    if (!name) return "";

    const domainKey = getIconKey(name);
    if (!domainKey) return "";

    const config = serverIconConfigs[domainKey];
    if (!config) return "";

    return getIconUrl(config);
  }, [name]);

  return iconUrl;
};
