// local-tests/dockerTest.ts
import Docker from 'dockerode';
import { waitForPort } from '../src/docker';

const docker     = new Docker();
const IMAGE      = 'nginx:stable-alpine';
const NAME       = 'smoke-docker-test';
const HOST_PORT  = 8080;

/** Pull an image with progress handling, returned as a Promise. */
function pullImage(image: string): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: any) => {
      if (err) return reject(err);
      docker.modem.followProgress(
        stream,
        (pullErr: Error | null) => (pullErr ? reject(pullErr) : resolve())
      );
    });
  });
}

(async () => {
  try {
    console.log(`→ Pulling ${IMAGE} …`);
    await pullImage(IMAGE);

    console.log(`→ Starting ${NAME} …`);
    const container = await docker.createContainer({
      name: NAME,
      Image: IMAGE,
      HostConfig: {
        PortBindings: { '80/tcp': [{ HostPort: String(HOST_PORT) }] },
      },
    });
    await container.start();

    await waitForPort('localhost', HOST_PORT, 15_000);
    console.log('✅ dockerTest passed – Nginx reachable');
  } catch (e) {
    console.error('❌ dockerTest failed:', (e as Error).message);
    process.exitCode = 1;
  } finally {
    try {
      const c = docker.getContainer(NAME);
      await c.stop();
      await c.remove({ force: true });
    } catch {      
    }
  }
})();