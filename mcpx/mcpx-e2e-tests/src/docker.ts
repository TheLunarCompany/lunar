// src/docker.ts
// -------------------
// Docker orchestration utilities for the E2E test framework
import path from 'path';
import Docker, {Network, Container } from 'dockerode';
import { Socket } from 'net';
import { waitForLog } from './utils';
import type { Scenario } from './types';

const docker = new Docker();

/** Options for starting a Docker container for testing. */
export interface StartContainerOpts {
  /** Image name (with tag) to run, e.g. 'myrepo/mcpx:0.1.7' */
  image: string;
  name: string;
  env?: Record<string, string>;
  /** Volume bindings in Docker syntax, e.g. ['host/path:container/path'] */
  binds?: string[];
  /**
   * Port mappings.
   * Key is containerPort (including protocol), value is hostPort.
   * e.g. { '9000/tcp': '9000', '3000/tcp': '3000' }
   */
  portBindings?: Record<string, string>;
  /** Optional Docker network to connect to */
  network?: string;
  /** If you need extra Linux capabilities (e.g. ['NET_ADMIN']) */
  capAdd?: string[];

  command?: string;
  args?: string[];
}

/**
 * Setup the MCPX container for a scenario.
 * This includes creating the network, removing any stale container,
 * and starting the MCPX container with the correct configuration.
 */
export async function setupMcpxContainer(
  name: string,
  dir: string,
  scenario: Scenario,
  networkName: string
): Promise<void> {
  // 1) Create network and remove any stale container
  await ensureNetwork(networkName);
  await ensureFreshContainer(name);
  
  // 2) Start MCPX
  const container = await startContainer({
    name: name,
    image: scenario.image,
    network: networkName,
    binds: scenario.configMount
      ? [ `${path.resolve(dir, scenario.configMount)}:/lunar/packages/mcpx-server/config` ]
      : undefined,
    env: scenario.env,
    capAdd: ['NET_ADMIN'],
    portBindings: {
      '5173/tcp': '5173',
      '9001/tcp': '9001',
      '9000/tcp': '9000',
      '3000/tcp': '3000'
    }
  });

  // 3) Wait until MCPX logs indicate the HTTP & SSE servers are really listening.
  //    I look for the exact log line:
  //      "MCPX server started on port 9000"
  //    because that only appears when the internal server is fully up.
  console.log('→ Need to wait a bit for the MCPX server to be fully ready...');
  await waitForLog(container, /MCPX server started on port 9000/, 30000);

  console.log('→ MCPX container is ready');  
}

/**
 * Ensure the image exists locally, then create & start the container.
 */
export async function startContainer(opts: StartContainerOpts): Promise<Container> {
  // 1) Pull image if not present
  const localImages = await docker.listImages({
    filters: { reference: [opts.image] } as unknown as any,
  });
  if (localImages.length === 0) {
    console.log(`→ Pulling image ${opts.image} …`);
    await new Promise<void>((resolve, reject) => {
      docker.pull(
        opts.image,
        (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) return reject(err);
          docker.modem.followProgress(
            stream,
            (pullErr: Error | null) => (pullErr ? reject(pullErr) : resolve()),
            /* progress callback not needed */ undefined
          );
        }
      );
    });
    console.log('   pull complete');
  }

  // 2) Create container
  const container = await docker.createContainer({
    Image: opts.image,
    name: opts.name,
    Cmd: opts.command ? [opts.command, ...(opts.args ?? [])] : undefined,
    Env: opts.env
      ? Object.entries(opts.env).map(([k, v]) => `${k}=${v}`)
      : undefined,
    HostConfig: {
      Binds: opts.binds,
      NetworkMode: opts.network,
      PortBindings: opts.portBindings
        ? Object.fromEntries(
            Object.entries(opts.portBindings).map(([c, h]) => [
              c,
              [{ HostPort: h }],
            ])
          )
        : undefined,
      CapAdd: opts.capAdd,
    },
  });

  // 3) Start container
  await container.start();
  console.log(`Container "${opts.name}" started successfully.`);
  return container;
}

/**
 * Stop (if running) and remove a container by name.
 * If the container does not exist, this silently completes.
 */
export async function stopAndRemove(name: string): Promise<void> {
  const container = docker.getContainer(name);
  // Attempt stop/remove; ignore any errors
  await container.stop().catch(() => undefined);
  await container.remove().catch(() => undefined);
}


/**
 * Wait until a TCP port on the host is accepting connections.
 * @param host    Hostname (e.g. 'localhost')
 * @param port    Port number
 * @param timeout How long (ms) to wait before failing
 */
export async function waitForPort(
  host: string,
  port: number,
  timeout = 30000
): Promise<void> {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const tryConnect = () => {
      const socket = new Socket();
      socket
        .once('error', () => {
          socket.destroy();
          if (Date.now() - start >= timeout) {
            reject(new Error(`Timeout waiting for ${host}:${port}`));
          } else {
            setTimeout(tryConnect, 500);
          }
        })
        .once('connect', () => {
          socket.end();
          resolve();
        })
        .connect(port, host);
    };
    tryConnect();
  });
}

/**
 * Create (or get) a Docker network by name.
 * @param name  Unique network name
 * @returns     The created or existing Network object
 */
export async function createNetwork(name: string): Promise<Network> {
  // CheckDuplicate:true makes this idempotent
  return docker.createNetwork({ Name: name, CheckDuplicate: true });
}

/**
 * Remove a Docker network by name.
 * @param name  Name of the network to remove
 */
export async function removeNetwork(name: string): Promise<void> {
  const network = docker.getNetwork(name);
  await network.remove().catch(() => undefined);
}

/**
 * Ensure a fresh container by stopping and removing it if it exists.
 * This is useful to avoid conflicts with leftover containers from previous runs.
 */
async function ensureFreshContainer(name: string) {
  try {
    await stopAndRemove(name);          // will log 404 if not present
  } catch { /* ignore */ }
}

/** Create (or reuse) a Docker network for this scenario. */
export async function ensureNetwork(name: string) {
  try {
    return await docker.createNetwork({ Name: name, Driver: 'bridge' });
  } catch (err: any) {
    if (err.statusCode === 409) {
      // Network already exists – just return a handle to it
      return docker.getNetwork(name);
    }
    throw err; // rethrow anything else
  }
}

/**
 * Tear down the network after all containers are removed.
 */
export async function teardownNetwork(networkName: string): Promise<void> {
  await removeNetwork(networkName);
}