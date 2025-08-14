#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { loadScenario } from './loadScenario';
import { setupMcpxContainer, ensureNetwork, teardownNetwork } from './docker';
import { startPlaywrightMcp, PlaywrightMcpHandle } from './playwrightMcp';
import { runSingleStep } from './runSingleStep';
import { validateOutput } from './validator';
import type { Scenario } from './types';
import { stopAndRemove } from './docker';
import {
  createGrafanaServiceAccountToken,
  waitForGrafanaHealthy,
  assertGrafanaHealthy,
} from './grafana';

import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { startDependentContainers, stopDependentContainers } from './dependentContainers';

async function runScenario(scenarioDir: string) {
  const scenario: Scenario = loadScenario(scenarioDir);
  const dirName = path.basename(scenarioDir); // e.g. sample-backend
  const networkName = `net-${dirName}`;
  const mcpxName = 'e2e-mcpx-gateway'; // main container name
  const runName = scenario.name ?? dirName;

  let pw: PlaywrightMcpHandle | undefined;

  // If we’re going to clean that mount, capture what was there to begin with:
  let initialConfigFiles: string[] = [];
  if (scenario.cleanConfigMount && scenario.configMount) {
    try {
      const mountDir = path.resolve(scenarioDir, scenario.configMount);
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
      await waitForGrafanaHealthy(hostGrafana, 60_000);
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
        scenario.verboseOutput ?? false
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

    await teardownNetwork(networkName).catch((e) => console.warn('[cleanup] network:', e.message));
    console.log('→ Cleanup complete');
  }
}

/* ------------------------------------------------------------------ */
if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: ts-node src/testRunner.ts <scenario-dir>');
    process.exit(1);
  }

  runScenario(dir)
    .then(() => {
      console.log('🎉 Scenario completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💔 Scenario error:', (err as Error).message);
      process.exit(1);
    });
}
