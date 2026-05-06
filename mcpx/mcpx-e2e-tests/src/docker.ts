// src/docker.ts
// -------------------
// Docker orchestration utilities for the E2E test framework
import path from 'path';
import Docker, { Network, Container } from 'dockerode';
import { Socket } from 'net';
import { waitForLog, expandEnvMap, ensureDir } from './utils';
import type { Scenario } from './types';
import { log } from 'console';

const docker = new Docker();

function isNotFoundError(err: unknown): boolean {
  const dockerErr = err as {
    statusCode?: number;
    reason?: string;
    json?: { message?: string };
    message?: string;
  };

  if (!dockerErr) {
    return false;
  }

  if (dockerErr.statusCode === 404) {
    return true;
  }

  const message = dockerErr.json?.message ?? dockerErr.message ?? dockerErr.reason ?? '';
  return /no such container/i.test(message);
}

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
  /** Run container with --privileged */
  privileged?: boolean;

  command?: string;
  args?: string[];
  user?: string;
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
  // 0) Remove any user-run MCPX container that would conflict with the test harness
  if (name !== 'mcpx') {
    await stopAndRemove('mcpx');
  }

  // 1) remove any stale container
  await ensureFreshContainer(name);

  // 2) Start MCPX
  const envVars = expandEnvMap(scenario.env) ?? {};
  if (!envVars['AUDIT_LOG_DIR']) {
    envVars['AUDIT_LOG_DIR'] = '/tmp';
  }
  if (!envVars['UV_CACHE_DIR']) {
    envVars['UV_CACHE_DIR'] = '/tmp/uv-cache';
  }

  const binds: string[] = [
    ...(scenario.configMount
      ? [`${path.resolve(dir, scenario.configMount)}:/lunar/packages/mcpx-server/config`]
      : []),
  ];

  if (envVars['UV_CACHE_DIR']) {
    const hostCacheDir = path.resolve(dir, '.mcpx-uv-cache');
    ensureDir(hostCacheDir);
    binds.push(`${hostCacheDir}:${envVars['UV_CACHE_DIR']}`);
  }

  const container = await startContainer({
    name: name,
    image: scenario.image,
    network: networkName,
    binds,
    env: envVars,
    privileged: true,
    user: 'root', // run as root to access Docker socket
    portBindings: {
      '5173/tcp': '5173',
      '9001/tcp': '9001',
      '9000/tcp': '9000',
    },
  });

  // 3) Wait until MCPX logs indicate the HTTP & SSE servers are really listening.
  //    I look for the exact log line:
  //      "MCPX server started on port 9000"
  //    because that only appears when the internal server is fully up.
  if (!scenario.expectErrorsOnStartup) {
    console.log('→ Need to wait a bit for the MCPX server to be fully ready...');
    try {
      await waitForLog(container, /MCPX server started on port 9000/, 120000);
    } catch (err) {
      try {
        const rawLogs = await container.logs({ stdout: true, stderr: true, tail: 200 });
        const text = Buffer.isBuffer(rawLogs) ? rawLogs.toString('utf8') : String(rawLogs);
        console.error('⚠️  MCPX startup logs (captured after timeout):\n', text);
      } catch (logErr) {
        console.error('⚠️  Failed to capture MCPX logs after timeout:', (logErr as Error).message);
      }
      throw err;
    }
  } else {
    console.log('→ Skipping readiness wait (expectErrorsOnStartup=true)');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log('→ MCPX container is ready');

  // Give target servers a moment to initialize before running steps that
  // immediately invoke backend tools. This helps avoid flaky startup races.
  await new Promise((resolve) => setTimeout(resolve, 4000));
}

/**
 * Ensure the image exists locally, then create & start the container.
 */
export async function startContainer(opts: StartContainerOpts): Promise<Container> {
  const pullImage = async () => {
    console.log(`→ Pulling image ${opts.image} …`);
    await new Promise<void>((resolve, reject) => {
      docker.pull(opts.image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        docker.modem.followProgress(
          stream,
          (pullErr: Error | null) => (pullErr ? reject(pullErr) : resolve()),
          /* progress callback not needed */ undefined
        );
      });
    });
    console.log('   pull complete');
  };

  const containerConfig: Docker.ContainerCreateOptions = {
    Image: opts.image,
    name: opts.name,
    User: opts.user,
    Cmd: opts.command ? [opts.command, ...(opts.args ?? [])] : undefined,
    Env: opts.env ? Object.entries(opts.env).map(([k, v]) => `${k}=${v}`) : undefined,
    HostConfig: {
      Binds: opts.binds,
      NetworkMode: opts.network,
      PortBindings: opts.portBindings
        ? Object.fromEntries(
            Object.entries(opts.portBindings).map(([c, h]) => [c, [{ HostPort: h }]])
          )
        : undefined,
      CapAdd: opts.capAdd,
      Privileged: !!opts.privileged,
    },
  };

  const isMissingImageError = (err: unknown) => {
    const dockerErr = err as { statusCode?: number; json?: { message?: string }; message?: string };
    if (!err) return false;
    const message = dockerErr.json?.message ?? dockerErr.message ?? '';
    return dockerErr.statusCode === 404 || /No such image/i.test(message);
  };

  log(`→ Creating container "${opts.name}" from image ${opts.image}…`);
  let container: Container;
  try {
    container = await docker.createContainer(containerConfig);
  } catch (err) {
    if (!isMissingImageError(err)) {
      throw err;
    }
    const dockerErr = err as { statusCode?: number; json?: { message?: string }; message?: string };
    const message = dockerErr.json?.message ?? dockerErr.message ?? 'unknown';
    console.log(
      `⚠️  Docker reported missing image ${opts.image} (status=${
        dockerErr.statusCode ?? 'n/a'
      } message=${message}). Attempting to pull…`
    );
    await pullImage();
    container = await docker.createContainer(containerConfig);
  }

  // 3) Start container
  await container.start();
  console.log(`Container "${opts.name}" started successfully.`);
  return container;
}

/**
 * Stop (if running) and remove a container by name.
 * If the container does not exist, this silently completes.
 */
export async function stopAndRemove(name: string): Promise<boolean> {
  const container = docker.getContainer(name);
  try {
    await container.inspect();
  } catch (err) {
    if (isNotFoundError(err)) {
      return false;
    }
    throw err;
  }

  console.log(`→ Removing existing container "${name}"`);
  // Attempt stop/remove; ignore any errors (including already-stopped)
  await container.stop().catch(() => undefined);
  await container.remove().catch(() => undefined);
  return true;
}

/**
 * Wait until a TCP port on the host is accepting connections.
 * @param host    Hostname (e.g. 'localhost')
 * @param port    Port number
 * @param timeout How long (ms) to wait before failing
 */
export async function waitForPort(host: string, port: number, timeout = 30000): Promise<void> {
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
    await stopAndRemove(name); // logs when a container is actually removed
  } catch {
    /* ignore */
  }
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
