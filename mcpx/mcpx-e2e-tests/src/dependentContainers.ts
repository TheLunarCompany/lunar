// src/dependentContainers.ts
import { Container } from 'dockerode';
import { startContainer, stopAndRemove } from './docker';
import { DependentContainer } from './types';
import { expandEnvMap } from './utils';
/**
 * Start all dependent containers on the given network.
 * Names will be prefixed with the scenario name.
 *
 * @param networkName   Docker network to attach to
 * @param deps          Array of DependentContainer specs
 */
export async function startDependentContainers(
  networkName: string,
  deps: DependentContainer[]
): Promise<Container[]> {
  const started: Container[] = [];
  console.log(`Starting dependent containers on network "${networkName}"`);
  for (const dep of deps) {
    const containerName = `${dep.name}`;
    console.log(`→ Stopping and removing any existing dependent container "${containerName}"`);
    await stopAndRemove(containerName);

    console.log(`Starting dependent container: ${containerName}`);
    // parse ports like ["8000:8000"] → { '8000/tcp': '8000' }
    const portBindings = dep.ports
      ? Object.fromEntries(
          dep.ports.map((p) => {
            const [host, cont] = p.split(':');
            return [`${cont}/tcp`, host];
          })
        )
      : undefined;

    // expand ${VAR} and $VAR from host env for this dependent
    const envExpanded = expandEnvMap(dep.env);
    const c = await startContainer({
      image: dep.image,
      name: containerName,
      env: envExpanded,
      privileged: dep.privileged === true,
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
export async function stopDependentContainers(deps: DependentContainer[]): Promise<void> {
  for (const dep of deps) {
    const containerName = `${dep.name}`;
    await stopAndRemove(containerName);
  }
}
