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
        since: 0,
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
        b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string'
    )
    .map((b) => b.text)
    .join('');
}

/**
 * Expand ${VAR} or $VAR placeholders using the current process.env.
 * Throws if a referenced VAR is not set to avoid silent misconfiguration.
 */
export function expandEnvVars(input: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!input) return input;
  // ${VAR} first
  let out = input.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
    const v = env[name];
    if (v === undefined) throw new Error(`Environment variable ${name} is not set`);
    return String(v);
  });
  // then $VAR (avoid $$ and already-expanded)
  out = out.replace(/(?<!\$)\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    const v = env[name];
    if (v === undefined) throw new Error(`Environment variable ${name} is not set`);
    return String(v);
  });
  return out;
}

/** Expand all string values in a key/value env map */
export function expandEnvMap<T extends Record<string, any> | undefined>(
  map: T,
  env: NodeJS.ProcessEnv = process.env
): Record<string, string> | undefined {
  if (!map) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? expandEnvVars(v, env) : String(v);
  }
  return out;
}
