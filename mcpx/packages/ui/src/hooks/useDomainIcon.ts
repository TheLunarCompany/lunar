import { useMemo } from "react";

const servicesNamesMapping = {
  slack: "https://slack.com/",
  microsoftTeams: "https://www.microsoft.com/microsoft-teams",
  zoom: "https://zoom.us/",
  googleMeet: "https://meet.google.com/",
  discord: "https://discord.com/",
  webex: "https://www.webex.com/",
  atlassian: "https://atlassian.com",
  ringCentral: "https://www.ringcentral.com/",
  goToMeeting: "https://www.goto.com/meeting",
  blueJeans: "https://www.bluejeans.com/",
  notion: "https://www.notion.com/",

  salesforce: "https://www.salesforce.com/",
  hubspot: "https://www.hubspot.com/",
  zoho: "https://www.zoho.com/crm/",
  microsoftDynamics: "https://dynamics.microsoft.com/",
  pipedrive: "https://www.pipedrive.com/",
  freshsales: "https://www.freshworks.com/freshsales-crm/",
  sugarCRM: "https://www.sugarcrm.com/",
  insightly: "https://www.insightly.com/",
  copper: "https://www.copper.com/",

  jira: "https://www.atlassian.com",
  asana: "https://asana.com/",
  trello: "https://trello.com/",
  monday: "https://monday.com/",
  clickUp: "https://clickup.com/",
  basecamp: "https://basecamp.com/",
  smartsheet: "https://www.smartsheet.com/",
  wrike: "https://www.wrike.com/",
  airtable: "https://www.airtable.com/",

  gitHub: "https://github.com/",
  gitLab: "https://gitlab.com/",
  bitbucket: "https://bitbucket.org/",
  azureDevOps: "https://dev.azure.com/",
  sourceForge: "https://sourceforge.net/",
  circleCI: "https://circleci.com/",
  travisCI: "https://travis-ci.com/",
  jenkins: "https://www.jenkins.io/",
  docker: "https://www.docker.com/",
  kubernetes: "https://kubernetes.io/",
  terraform: "https://www.terraform.io/",
  hashicorpVault: "https://www.vaultproject.io/",
  redis: "https://redis.io/",
  snowflake: "https://www.snowflake.com/",
  postgres: "https://www.postgresql.org",
  launchdarkly: "https://launchdarkly.com/",
  playwright: "https://playwright.dev/",

  sentry: "https://sentry.io/",
  datadog: "https://www.datadoghq.com/",
  newRelic: "https://newrelic.com/",
  splunk: "https://www.splunk.com/",
  elastic: "https://www.elastic.co/",
  rollbar: "https://rollbar.com/",
  grafana: "https://grafana.com/",
  prometheus: "https://prometheus.io/",
  honeycomb: "https://www.honeycomb.io/",
  appDynamics: "https://www.appdynamics.com/",
  linear: "https://linear.app/",
};

export function isIconExists(name: string) {
  return Object.keys(servicesNamesMapping).find(
    (key) => name.toLowerCase() === key.toLowerCase(),
  );
}

export const useDomainIcon = (name: string) => {
  const iconUrl = useMemo(() => {
    if (!name) return "";
    const domainKey = Object.keys(servicesNamesMapping).find(
      (key) => name.toLowerCase() === key.toLowerCase(),
    );

    if (!domainKey) {
      return "";
    }

    return `/icons/${domainKey}.png`;
  }, [name]);

  return iconUrl;
};