#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';
import { loadScenario } from './loadScenario';
import { setupMcpxContainer, ensureNetwork, teardownNetwork } from './docker';
import { startPlaywrightMcp, PlaywrightMcpHandle } from './playwrightMcp';
import { runSingleStep } from './runSingleStep';
import { validateOutput } from './validator';
import type { Scenario, SlackCleanupConfig } from './types';
import { stopAndRemove } from './docker';
import { ensureDir } from './utils';
import {
  createGrafanaServiceAccountToken,
  waitForGrafanaHealthy,
  assertGrafanaHealthy,
} from './grafana';
import axios from 'axios';

import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { startDependentContainers, stopDependentContainers } from './dependentContainers';
import { createAgentController } from './aiAgents';
import type { AiAgentController } from './aiAgents';

let lastScenarioWarnings: string[] = [];
let lastScenarioLabel = '';
let lastScenarioDir = '';

function formatWarningMessage(args: unknown[]): string {
  if (!args.length) {
    return '';
  }

  try {
    return format(...(args as [unknown, ...unknown[]]));
  } catch {
    return args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.message;
        }
        if (typeof arg === 'string') {
          return arg;
        }
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');
  }
}

function emitScenarioWarningsSummary(): void {
  if (!lastScenarioWarnings.length) {
    return;
  }

  const location = lastScenarioDir ? ` (${lastScenarioDir})` : '';
  const label = lastScenarioLabel || 'unknown scenario';

  console.log(`\n⚠️  Warnings during scenario "${label}"${location}:`);
  for (const warning of lastScenarioWarnings) {
    console.log(`  - ${warning}`);
  }
}

async function cleanupSlackMessages(configs?: SlackCleanupConfig[]) {
  if (!configs?.length) {
    return;
  }

  for (const config of configs) {
    const tokenEnv = config.tokenEnvVar ?? 'SLACK_MCP_XOXP_TOKEN';
    const token = process.env[tokenEnv];
    if (!token) {
      console.warn(
        `⚠️  Slack cleanup skipped for channel ${config.channelId}: missing ${tokenEnv}`
      );
      continue;
    }

    const maxAgeMinutes = config.maxAgeMinutes ?? 30;
    const historyLimit = config.messageLimit ?? 20;
    const fragment = config.textFragment;

    try {
      const oldestSeconds = Date.now() / 1000 - maxAgeMinutes * 60;
      const params: Record<string, string | number> = {
        channel: config.channelId,
        limit: historyLimit,
      };
      if (maxAgeMinutes > 0) {
        params.oldest = oldestSeconds.toFixed(6);
      }

      const historyResp = await axios.get('https://slack.com/api/conversations.history', {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!historyResp.data?.ok) {
        console.warn(
          `⚠️  Slack cleanup unable to fetch history for ${config.channelId}: ${
            historyResp.data?.error || 'unknown error'
          }`
        );
        continue;
      }

      const messages: Array<{ ts?: string; text?: string }> = historyResp.data.messages ?? [];
      const matches = messages.filter(
        (msg) => typeof msg.text === 'string' && msg.text.includes(fragment)
      );

      if (matches.length === 0) {
        console.log(
          `ℹ️  Slack cleanup found no messages containing "${fragment}" in ${config.channelId}`
        );
        continue;
      }

      for (const msg of matches.slice(0, historyLimit)) {
        if (!msg.ts) {
          continue;
        }
        try {
          const body = new URLSearchParams({ channel: config.channelId, ts: msg.ts });
          const deleteResp = await axios.post(
            'https://slack.com/api/chat.delete',
            body.toString(),
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );

          if (!deleteResp.data?.ok) {
            console.warn(
              `⚠️  Slack cleanup failed to delete message ${msg.ts}: ${
                deleteResp.data?.error || 'unknown error'
              }`
            );
          } else {
            console.log(`🧹 Deleted Slack message ${msg.ts} from ${config.channelId}`);
          }
        } catch (err) {
          console.warn(
            `⚠️  Slack cleanup error deleting message ${msg.ts}:`,
            (err as Error).message
          );
        }
      }
    } catch (err) {
      console.warn(
        `⚠️  Slack cleanup error while processing channel ${config.channelId}:`,
        (err as Error).message
      );
    }
  }
}

async function runScenario(scenarioDir: string) {
  const scenarioWarnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = ((...args: Parameters<typeof console.warn>) => {
    const formatted = formatWarningMessage(args as unknown[]);
    scenarioWarnings.push(formatted);
    originalWarn.apply(console, args as unknown[]);
  }) as typeof console.warn;

  const normalizedDir = path.isAbsolute(scenarioDir)
    ? path.relative(process.cwd(), scenarioDir)
    : path.normalize(scenarioDir);

  lastScenarioDir = normalizedDir;
  lastScenarioWarnings = [];
  lastScenarioLabel = path.basename(normalizedDir);

  let runName = lastScenarioLabel;

  try {
    const scenario: Scenario = loadScenario(scenarioDir);

    let agentController: AiAgentController | undefined;

    const dirName = path.basename(scenarioDir); // e.g. sample-backend
    runName = scenario.name ?? dirName;

    if (scenario.disableTest) {
      console.log(`Skipping scenario: ${scenario.name || dirName}`);
      return;
    }

    if (scenario.aiAgent) {
      agentController = createAgentController(scenario.aiAgent, {
        verboseOutput: scenario.verboseOutput ?? false,
      });
      const prepResult = await agentController.prepare();
      if (prepResult === 'skip') {
        console.log('Skipping scenario because required AI agent is unavailable.');
        return;
      }
    }

    const networkName = `net-${dirName}`;
    const mcpxName = 'e2e-mcpx-gateway'; // main container name

    let pw: PlaywrightMcpHandle | undefined;

    const mountDir = path.resolve(scenarioDir, scenario.configMount || 'config');
    // Ensure config dir exists so snapshotting won't throw ENOENT
    ensureDir(mountDir);

    // If we’re going to clean that mount, capture what was there to begin with:
    let initialConfigFiles: string[] = [];
    if (scenario.cleanConfigMount && scenario.configMount) {
      try {
        initialConfigFiles = fs.readdirSync(mountDir);
        console.log(`Initial files in ${mountDir}:`, initialConfigFiles);
      } catch (e) {
        console.warn('⚠️  Failed to snapshot initial config-mount:', e);
      }
    }

    console.log(`=== Running scenario: ${runName} ===`);

    try {
      // 0) Ensure the network exists
      console.log(`→ Ensuring network "${networkName}" exists`);
      await ensureNetwork(networkName);
      console.log(`→ Network "${networkName}" is ready`);

      // 1) start any dependent containers (e.g. grafana, playwright-mcp, etc.)
      if (scenario.dependentContainers?.length) {
        console.log('→ Starting dependent containers…');
        await startDependentContainers(networkName, scenario.dependentContainers);
      }

      // 2) If Grafana is a dependency, wait for health and create a short-lived API token.
      if (scenario.dependentContainers?.some((d) => d.name === 'grafana')) {
        // Runner talks to Grafana via the host-published port
        const hostGrafana = 'http://127.0.0.1:3000';
        await waitForGrafanaHealthy(hostGrafana, 120_000);
        await assertGrafanaHealthy(hostGrafana, 'admin', 'admin');

        const token = await createGrafanaServiceAccountToken({
          baseUrl: hostGrafana,
          adminUser: 'admin',
          adminPass: 'admin',
          saName: 'mcpx-e2e',
          tokenName: 'mcpx-e2e-token',
          ttlSeconds: 3600,
        });

        // The grafana MCP container should use the host alias
        // (portable on Linux when docker run includes: --add-host host.docker.internal:host-gateway)
        const grafanaUrl = 'http://host.docker.internal:3000';

        scenario.env = {
          ...(scenario.env ?? {}),
          GRAFANA_URL: grafanaUrl,
          GRAFANA_API_KEY: token,
        };
        console.log('→ Grafana token created and injected into scenario env');
      }

      // 3) Ensure the MCPX container is set up
      await setupMcpxContainer(mcpxName, scenarioDir, scenario, networkName);

      if (agentController) {
        await agentController.start();
      }

      // run scenario steps
      let browserClient: Client | undefined;
      let browserTransport: SSEClientTransport | undefined;
      for (const step of scenario.steps) {
        let base: string;
        const stepName = step.name ?? step.toolName;
        console.log(`→ Step: ${stepName} (${step.kind})`);

        if (step.kind === 'browser') {
          if (!pw) pw = await startPlaywrightMcp();
          if (!pw) throw new Error('Playwright MCP failed to start');

          // Only first browser step creates the transport+client
          if (!browserTransport) {
            const url = `${pw.baseUrl}/messages`;
            console.log(`   → Connecting to MCP server at ${url}`);
            browserTransport = new SSEClientTransport(new URL(url));
            browserClient = new Client({ name: 'e2e', version: '1.0.0' });
            await browserClient.connect(browserTransport);
          }
          base = pw.baseUrl; // host:port, NO path
        } else {
          base = 'http://localhost:9000';
        }
        const output = await runSingleStep(
          step,
          base,
          browserClient,
          browserTransport,
          scenario.verboseOutput ?? false,
          agentController
        );
        const result = validateOutput(output, step.expected);

        if (!result.success) {
          throw new Error(`Validation failed: ${result.errors?.join(' | ')}`);
        }
        console.log('✅ Validation passed');
      }
    } finally {
      console.log('→ Cleaning up...');

      // If requested, remove only the files that appeared during the test:
      if (scenario.cleanConfigMount && scenario.configMount) {
        const mountDir = path.resolve(scenarioDir, scenario.configMount);
        try {
          console.log(`🧹 Cleaning new files in ${mountDir}`);
          const allFiles = fs.readdirSync(mountDir);
          for (const file of allFiles) {
            if (!initialConfigFiles.includes(file)) {
              const full = path.join(mountDir, file);
              console.log(`  → removing ${file}`);
              fs.rmSync(full, { recursive: true, force: true });
            }
          }
        } catch (cleanupErr) {
          console.warn(`⚠️  Couldn't clean mount ${mountDir}:`, cleanupErr);
        }
      }

      if (agentController) {
        await agentController
          .cleanup()
          .catch((e) => console.warn('[cleanup] aiAgent:', (e as Error).message));
      }

      if (scenario.cleanup?.slackMessages?.length) {
        console.log('→ Slack cleanup starting');
        await cleanupSlackMessages(scenario.cleanup.slackMessages).catch((e) =>
          console.warn('[cleanup] slack:', (e as Error).message)
        );
      }

      if (pw) {
        pw.closeTransport(); //End SSE stream first
        await pw.shutdown().catch((e) => console.warn('[cleanup] playwright:', e.message));
      }

      await stopAndRemove(mcpxName).catch((e) => console.warn('[cleanup] MCPX:', e.message));

      if (scenario.dependentContainers?.length) {
        await stopDependentContainers(scenario.dependentContainers).catch((e) =>
          console.warn('[cleanup] dependents:', e.message)
        );
      }

      await teardownNetwork(networkName).catch((e) =>
        console.warn('[cleanup] network:', e.message)
      );
      console.log('→ Cleanup complete');
    }
  } finally {
    const warningsSnapshot = scenarioWarnings.filter(
      (message) => typeof message === 'string' && message.trim().length > 0
    );

    console.warn = originalWarn;
    lastScenarioWarnings = warningsSnapshot;
    lastScenarioLabel = runName;

    const warningsFile = process.env.MCPX_E2E_WARNINGS_FILE;
    if (warningsFile && warningsSnapshot.length) {
      try {
        fs.appendFileSync(
          warningsFile,
          `${JSON.stringify({
            scenario: runName,
            scenarioDir: normalizedDir,
            warnings: warningsSnapshot,
            timestamp: new Date().toISOString(),
          })}\n`
        );
      } catch (err) {
        originalWarn('⚠️  Failed to append scenario warnings file:', (err as Error).message);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: ts-node src/testRunner.ts <scenario-dir>');
    process.exit(1);
  }

  (async () => {
    try {
      await runScenario(dir);
      console.log('🎉 Scenario completed');
    } catch (err) {
      console.error('💔 Scenario error:', (err as Error).message);
      process.exitCode = 1;
    } finally {
      emitScenarioWarningsSummary();
      process.exit(process.exitCode ?? 0);
    }
  })();
}
