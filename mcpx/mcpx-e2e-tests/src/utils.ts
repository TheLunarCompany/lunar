// src/utils.ts
import type { Container } from 'dockerode';
import type { Readable } from 'stream';

/**
 * Stream a container’s stdout+stderr and resolve as soon as we see `pattern`.
 * Rejects if we hit the timeout first.
 */
export function waitForLog(
  container: Container,
  pattern: RegExp,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    let logStream: Readable;

    const timer = setTimeout(() => {
      // on timeout, destroy the stream to stop Docker pulling logs
      logStream.destroy();
      reject(new Error(`Timed out waiting for log ${pattern}`));
    }, timeoutMs);

    // cast to any so TS won't try to pick the wrong overload
    (container.logs as any)(
      {
        stdout: true,
        stderr: true,
        follow: true,
        since: 0
      },
      (err: any, stream: any) => {
        if (err) {
          clearTimeout(timer);
          return reject(err);
        }

        // At runtime Dockerode gives a Node Readable here
        logStream = stream as Readable;

        logStream.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf8');
          if (pattern.test(text)) {
            clearTimeout(timer);
            logStream.destroy();
            resolve();
          }
        });

        logStream.on('error', (streamErr: Error) => {
          clearTimeout(timer);
          reject(streamErr);
        });
      }
    );
  });
}

export function extractText(result: any): string {
  const blocks = result?.content;
  if (!Array.isArray(blocks)) return '';

  return blocks
    .filter(
      (b: any): b is { type: string; text: string } =>
        b &&
        typeof b === 'object' &&
        b.type === 'text' &&
        typeof b.text === 'string'
    )
    .map(b => b.text)
    .join('');
}