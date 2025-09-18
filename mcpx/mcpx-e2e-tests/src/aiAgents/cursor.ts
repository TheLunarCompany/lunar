import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { execFile } from 'child_process';
import axios from 'axios';
import { setTimeout as delay } from 'timers/promises';
import { CursorAgentRequirement } from '../types';
import { AiAgentController, AgentPreparationResult } from './types';

const execFileAsync = promisify(execFile);

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.cursor', 'mcp.json');
const DEFAULT_SERVER_KEY = 'mcpx';
const DEFAULT_URL = 'http://127.0.0.1:9000/mcp';
const DEFAULT_TIMEOUT_SEC = 120;

function expandHome(p: string): string {
  if (!p.startsWith('~')) return path.resolve(p);
  return path.resolve(path.join(os.homedir(), p.slice(1)));
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

async function quitCursor(): Promise<void> {
  try {
    await execFileAsync('osascript', ['-e', 'tell application "Cursor" to quit']);
  } catch (err: any) {
    if (err?.code !== 1) {
      throw err;
    }
  }
}

async function isCursorRunning(): Promise<boolean> {
  try {
    await execFileAsync('pgrep', ['-x', 'Cursor']);
    return true;
  } catch (err: any) {
    if (err?.code === 1) return false;
    throw err;
  }
}

async function waitForCursorExit(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isCursorRunning())) return;
    await delay(500);
  }
  throw new Error('Cursor did not exit within the expected timeout');
}

interface CursorState {
  configPath: string;
  serverKey: string;
  url: string;
  startupTimeoutSec: number;
}

export class CursorController implements AiAgentController {
  public readonly requirement: CursorAgentRequirement;
  private readonly state: CursorState;
  private originalConfig?: string;
  private configExisted = false;
  private startedAgent = false;

  constructor(requirement: CursorAgentRequirement, state: CursorState) {
    this.requirement = requirement;
    this.state = state;
  }

  async prepare(): Promise<AgentPreparationResult> {
    if (process.platform !== 'darwin') {
      if (this.requirement.skipIfMissing ?? true) {
        console.warn('⚠️  Cursor tests require macOS for automation. Skipping scenario.');
        return 'skip';
      }
      throw new Error('Cursor tests require macOS for automation.');
    }

    if (!(await this.detectInstallation())) {
      if (this.requirement.skipIfMissing ?? true) {
        console.warn('⚠️  Cursor not detected. Skipping scenario.');
        return 'skip';
      }
      throw new Error('Cursor app not detected at expected locations.');
    }

    await this.ensureConfigEntry();

    if (await isCursorRunning()) {
      console.log('→ Cursor is running, requesting it to quit before the test');
      await quitCursor();
      await waitForCursorExit(10_000);
    }

    return 'ready';
  }

  async start(): Promise<void> {
    console.log('→ Launching Cursor');
    await execFileAsync('open', ['--hide', '--background', '-gj', '-a', 'Cursor']);
    this.startedAgent = true;
    await this.waitForAgentConnection();
  }

  async cleanup(): Promise<void> {
    if (this.startedAgent) {
      try {
        console.log('→ Stopping Cursor');
        await quitCursor();
        await waitForCursorExit(10_000);
      } catch (err) {
        console.warn('⚠️  Failed to stop Cursor:', (err as Error).message);
      }
    }

    await this.restoreConfig();
  }

  private async detectInstallation(): Promise<boolean> {
    const candidates = [
      '/Applications/Cursor.app',
      path.join(os.homedir(), 'Applications', 'Cursor.app'),
      path.dirname(this.state.configPath),
    ];
    for (const candidate of candidates) {
      if (await fileExists(candidate)) return true;
    }
    return false;
  }

  private async ensureConfigEntry(): Promise<void> {
    const { configPath, serverKey, url } = this.state;
    const dir = path.dirname(configPath);
    if (!(await directoryExists(dir))) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    let existing: Record<string, any> = {};
    if (await fileExists(configPath)) {
      this.configExisted = true;
      this.originalConfig = await fs.promises.readFile(configPath, 'utf8');
      try {
        existing = JSON.parse(this.originalConfig);
      } catch (err) {
        throw new Error(
          `Failed to parse existing Cursor config at ${configPath}: ${(err as Error).message}`
        );
      }
    }

    const servers =
      existing.mcpServers && typeof existing.mcpServers === 'object' ? existing.mcpServers : {};

    servers[serverKey] = {
      ...(typeof servers[serverKey] === 'object' ? servers[serverKey] : {}),
      url,
    };

    const updated = {
      ...existing,
      mcpServers: servers,
    };

    const newContent = JSON.stringify(updated, null, 2) + '\n';
    if (newContent !== this.originalConfig) {
      await fs.promises.writeFile(configPath, newContent, 'utf8');
    }
  }

  private async restoreConfig(): Promise<void> {
    const { configPath } = this.state;
    try {
      if (this.configExisted) {
        if (this.originalConfig !== undefined) {
          await fs.promises.writeFile(configPath, this.originalConfig, 'utf8');
        }
      } else {
        if (await fileExists(configPath)) {
          await fs.promises.unlink(configPath);
        }
      }
    } catch (err) {
      console.warn('⚠️  Failed to restore Cursor config file:', (err as Error).message);
    }
  }

  private async waitForAgentConnection(): Promise<void> {
    const { startupTimeoutSec } = this.state;
    const timeoutMs = startupTimeoutSec * 1000;
    const deadline = Date.now() + timeoutMs;

    console.log('→ Waiting for Cursor to connect to MCPX');
    while (Date.now() < deadline) {
      try {
        const response = await axios.get('http://localhost:9000/system-state', {
          timeout: 5_000,
        });
        const clients = response.data?.connectedClients;
        if (Array.isArray(clients)) {
          const found = clients.some((client: any) => {
            const name = client?.clientInfo?.name;
            if (typeof name === 'string' && name.toLowerCase().includes('cursor')) return true;
            const tag = client?.consumerTag;
            return typeof tag === 'string' && tag.toLowerCase().includes('cursor');
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

    throw new Error(`Timed out waiting ${startupTimeoutSec}s for Cursor to connect to MCPX`);
  }
}

export function createCursorController(requirement: CursorAgentRequirement): CursorController {
  const configPath = expandHome(requirement.configPath ?? DEFAULT_CONFIG_PATH);
  const serverKey = requirement.serverKey ?? DEFAULT_SERVER_KEY;
  const url = requirement.url ?? DEFAULT_URL;
  const startupTimeoutSec = requirement.startupTimeoutSec ?? DEFAULT_TIMEOUT_SEC;

  const state: CursorState = {
    configPath,
    serverKey,
    url,
    startupTimeoutSec,
  };

  return new CursorController(requirement, state);
}
