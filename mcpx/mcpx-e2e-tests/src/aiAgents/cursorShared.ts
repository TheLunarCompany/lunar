import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { setTimeout as delay } from 'timers/promises';

interface CursorConfigSnapshotEntry {
  path: string;
  existed: boolean;
  originalContent?: string;
}

export interface CursorConfigSnapshot {
  files: CursorConfigSnapshotEntry[];
}

export interface CursorConfigOptions {
  configPath: string;
  serverKey: string;
  url: string;
  projectConfigPath?: string;
}

export function expandHome(p: string): string {
  if (!p.startsWith('~')) return path.resolve(p);
  return path.resolve(path.join(os.homedir(), p.slice(1)));
}

export async function ensureCursorConfig({
  configPath,
  serverKey,
  url,
  projectConfigPath,
}: CursorConfigOptions): Promise<CursorConfigSnapshot> {
  const targets = [configPath, projectConfigPath].filter((entry): entry is string =>
    Boolean(entry)
  );

  const files: CursorConfigSnapshotEntry[] = [];

  for (const target of targets) {
    files.push(await ensureSingleConfig(target, serverKey, url));
  }

  return { files };
}

export async function restoreCursorConfig(snapshot: CursorConfigSnapshot): Promise<void> {
  for (const entry of snapshot.files) {
    const { path: filePath, existed, originalContent } = entry;

    try {
      if (existed) {
        if (originalContent !== undefined) {
          await fs.promises.writeFile(filePath, originalContent, 'utf8');
        }
      } else if (await fileExists(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.warn('⚠️  Failed to restore Cursor config file:', (err as Error).message);
    }
  }
}

export async function waitForCursorConnection({
  startupTimeoutSec,
  expectedMatch = 'cursor',
}: {
  startupTimeoutSec: number;
  expectedMatch?: string;
}): Promise<void> {
  const timeoutMs = startupTimeoutSec * 1000;
  const deadline = Date.now() + timeoutMs;
  const match = expectedMatch.toLowerCase();
  let lastSeenSignature: string | undefined;

  console.log(`→ Waiting for Cursor agent (${match}) to connect to MCPX`);
  while (Date.now() < deadline) {
    try {
      const response = await axios.get('http://localhost:9000/system-state', {
        timeout: 5_000,
      });
      const clients = response.data?.connectedClients;
      if (Array.isArray(clients)) {
        const found = clients.some((client: any) => {
          const name = typeof client?.clientInfo?.name === 'string' ? client.clientInfo.name : '';
          const tag = typeof client?.consumerTag === 'string' ? client.consumerTag : '';
          return name.toLowerCase().includes(match) || tag.toLowerCase().includes(match);
        });
        if (found) {
          console.log('✅ Cursor agent connected');
          return;
        }

        const signature = JSON.stringify(
          clients.map((client: any) => ({
            name: typeof client?.clientInfo?.name === 'string' ? client.clientInfo.name : undefined,
            tag: typeof client?.consumerTag === 'string' ? client.consumerTag : undefined,
          }))
        );
        if (signature && signature !== lastSeenSignature) {
          console.log('ℹ️  Connected clients present but no cursor match yet:', signature);
          lastSeenSignature = signature;
        }
      }
    } catch (err: any) {
      if (err?.code !== 'ECONNREFUSED') {
        console.debug('Polling system-state failed:', err?.message ?? err);
      }
    }
    await delay(2_000);
  }

  throw new Error(`Timed out waiting ${startupTimeoutSec}s for Cursor agent to connect to MCPX`);
}

async function ensureDirectory(dir: string): Promise<void> {
  if (!(await directoryExists(dir))) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.promises.access(file, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function ensureSingleConfig(
  filePath: string,
  serverKey: string,
  url: string
): Promise<CursorConfigSnapshotEntry> {
  await ensureDirectory(path.dirname(filePath));

  let originalContent: string | undefined;
  let existed = false;
  let existingConfig: Record<string, any> = {};

  if (await fileExists(filePath)) {
    existed = true;
    originalContent = await fs.promises.readFile(filePath, 'utf8');
    try {
      existingConfig = JSON.parse(originalContent);
    } catch (err) {
      throw new Error(
        `Failed to parse existing Cursor config at ${filePath}: ${(err as Error).message}`
      );
    }
  }

  const servers =
    existingConfig.mcpServers && typeof existingConfig.mcpServers === 'object'
      ? { ...existingConfig.mcpServers }
      : {};

  const existingEntry =
    typeof servers[serverKey] === 'object' && servers[serverKey] !== null
      ? { ...servers[serverKey] }
      : {};

  const headers =
    typeof existingEntry.headers === 'object' && existingEntry.headers !== null
      ? { ...existingEntry.headers }
      : {};

  if (!headers['x-lunar-consumer-tag']) {
    headers['x-lunar-consumer-tag'] = 'Cursor';
  }

  servers[serverKey] = {
    ...existingEntry,
    url,
    headers,
  };

  const updated = {
    ...existingConfig,
    mcpServers: servers,
  };

  const newContent = JSON.stringify(updated, null, 2) + '\n';
  if (newContent !== originalContent) {
    await fs.promises.writeFile(filePath, newContent, 'utf8');
  }

  return { path: filePath, existed, originalContent };
}
