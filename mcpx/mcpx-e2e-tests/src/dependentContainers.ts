// src/dependentContainers.ts
import { Container } from 'dockerode';
import { startContainer, stopAndRemove } from './docker';
import { DependentContainer } from './types';

/**
 * Start all dependent containers on the given network.
 * Names will be prefixed with the scenario name.
 *
 * @param scenarioName  Unique name for this scenario
 * @param networkName   Docker network to attach to
 * @param deps          Array of DependentContainer specs
 */
export async function startDependentContainers(
  scenarioName: string,
  networkName: string,
  deps: DependentContainer[]
): Promise<Container[]> {
  const started: Container[] = [];

  for (const dep of deps) {
    const containerName = `${scenarioName}-${dep.name}`;
    console.log(`Starting dependent container: ${containerName}`);
    // parse ports like ["8000:8000"] → { '8000/tcp': '8000' }
    const portBindings = dep.ports
      ? Object.fromEntries(
          dep.ports.map(p => {
            const [host, cont] = p.split(':');
            return [`${cont}/tcp`, host];
          })
        )
      : undefined;

    const c = await startContainer({
      image: dep.image,
      name: containerName,
      env: dep.env,
      portBindings,
      network: networkName,
      command: dep.command,
      args: dep.args,
    });
    started.push(c);
  }

  return started;
}

/**
 * Stop & remove all dependent containers for this scenario.
 */
export async function stopDependentContainers(
  scenarioName: string,
  deps: DependentContainer[]
): Promise<void> {
  for (const dep of deps) {
    const containerName = `${scenarioName}-${dep.name}`;
    await stopAndRemove(containerName);
  }
}

