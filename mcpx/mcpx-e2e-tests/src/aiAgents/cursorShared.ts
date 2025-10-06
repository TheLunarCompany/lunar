import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { setTimeout as delay } from 'timers/promises';

export interface CursorConfigOptions {
  configPath: string;
  serverKey: string;
  url: string;
}

export interface CursorConfigSnapshot {
  configPath: string;
  existed: boolean;
  originalContent?: string;
}

export function expandHome(p: string): string {
  if (!p.startsWith('~')) return path.resolve(p);
  return path.resolve(path.join(os.homedir(), p.slice(1)));
}

export async function ensureCursorConfig({
  configPath,
  serverKey,
  url,
}: CursorConfigOptions): Promise<CursorConfigSnapshot> {
  await ensureDirectory(path.dirname(configPath));

  let originalContent: string | undefined;
  let existed = false;
  let existingConfig: Record<string, any> = {};

  if (await fileExists(configPath)) {
    existed = true;
    originalContent = await fs.promises.readFile(configPath, 'utf8');
    try {
      existingConfig = JSON.parse(originalContent);
    } catch (err) {
      throw new Error(
        `Failed to parse existing Cursor config at ${configPath}: ${(err as Error).message}`
      );
    }
  }

  const servers =
    existingConfig.mcpServers && typeof existingConfig.mcpServers === 'object'
      ? existingConfig.mcpServers
      : {};

  servers[serverKey] = {
    ...(typeof servers[serverKey] === 'object' ? servers[serverKey] : {}),
    url,
  };

  const updated = {
    ...existingConfig,
    mcpServers: servers,
  };

  const newContent = JSON.stringify(updated, null, 2) + '\n';
  if (newContent !== originalContent) {
    await fs.promises.writeFile(configPath, newContent, 'utf8');
  }

  return { configPath, existed, originalContent };
}

export async function restoreCursorConfig(snapshot: CursorConfigSnapshot): Promise<void> {
  const { configPath, existed, originalContent } = snapshot;

  try {
    if (existed) {
      if (originalContent !== undefined) {
        await fs.promises.writeFile(configPath, originalContent, 'utf8');
      }
    } else if (await fileExists(configPath)) {
      await fs.promises.unlink(configPath);
    }
  } catch (err) {
    console.warn('⚠️  Failed to restore Cursor config file:', (err as Error).message);
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
