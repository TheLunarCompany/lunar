#!/usr/bin/env ts-node
import Docker from 'dockerode';
import path from 'path';
import { startDependentContainers, stopDependentContainers } from '../src/dependentContainers';

import { ensureNetwork, teardownNetwork } from '../src/docker';

interface DependentContainerSpec {
  name: string;
  image: string;
  ports?: string[];
  env?: Record<string, string>;
}

async function main() {
  const networkName = 'smoke-dep-test-net';
  const scenarioName = 'smoke-dep-test';
  const deps: DependentContainerSpec[] = [
    {
      name: 'nginx',
      image: 'nginx:alpine',
      ports: ['8080:80'], // map container 80→host 8080
    },
  ];

  try {
    console.log(`→ Ensuring network "${networkName}" exists`);
    await ensureNetwork(networkName);

    console.log(`→ Starting dependent containers...`);
    const containers = await startDependentContainers(networkName, deps);
    console.log(`→ Started containers: ${containers.map((c) => c.id).join(', ')}`);

    // verify each one is actually running:
    const docker = new Docker();
    for (const dep of deps) {
      const containerName = `${scenarioName}-${dep.name}`;
      console.log(`→ Inspecting container "${containerName}"`);
      const ctr = docker.getContainer(containerName);
      const info = await ctr.inspect();
      if (!info.State.Running) {
        throw new Error(`Container ${containerName} is not running!`);
      }
      console.log(`✅ "${containerName}" is running`);
    }

    console.log('🎉 Smoke test passed');
  } catch (err: any) {
    console.error('❌ Smoke test failed:', err.message);
    process.exit(1);
  } finally {
    console.log('→ Cleaning up dependent containers...');
    await stopDependentContainers(deps);

    console.log('→ Removing network...');
    await teardownNetwork(networkName);
    console.log('→ Cleanup complete');
  }
}

main();
