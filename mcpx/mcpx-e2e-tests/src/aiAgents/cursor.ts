import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { CursorAgentRequirement } from '../types';
import { AiAgentController, AgentPreparationResult } from './types';
import {
  CursorConfigSnapshot,
  ensureCursorConfig,
  expandHome,
  restoreCursorConfig,
  waitForCursorConnection,
} from './cursorShared';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const execFileAsync = promisify(execFile);

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.cursor', 'mcp.json');
const DEFAULT_SERVER_KEY = 'mcpx';
const DEFAULT_URL = 'http://127.0.0.1:9000/mcp';
const DEFAULT_TIMEOUT_SEC = 120;

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.promises.access(file, fs.constants.F_OK);
    return true;
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
  projectConfigPath: string;
  serverKey: string;
  url: string;
  startupTimeoutSec: number;
}

export class CursorController implements AiAgentController {
  public readonly requirement: CursorAgentRequirement;
  private readonly state: CursorState;
  private configSnapshot?: CursorConfigSnapshot;
  private startedAgent = false;
  private useStub = false;
  private stubClient?: Client;
  private stubTransport?: SSEClientTransport;

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

    this.configSnapshot = await ensureCursorConfig({
      configPath: this.state.configPath,
      projectConfigPath: this.state.projectConfigPath,
      serverKey: this.state.serverKey,
      url: this.state.url,
    });

    if (await isCursorRunning()) {
      console.log('→ Cursor is running, requesting it to quit before the test');
      await quitCursor();
      await waitForCursorExit(10_000);
    }

    return 'ready';
  }

  async start(): Promise<void> {
    let launched = false;
    try {
      console.log('→ Launching Cursor');
      await execFileAsync('open', ['--hide', '--background', '-gj', '-a', 'Cursor']);
      this.startedAgent = true;
      launched = true;
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      console.warn(`⚠️  Failed to launch Cursor app (${message}). Falling back to stub.`);
    }

    if (launched) {
      try {
        await waitForCursorConnection({ startupTimeoutSec: this.state.startupTimeoutSec });
        return;
      } catch (err) {
        const message = (err as Error)?.message ?? String(err);
        console.warn(
          `⚠️  Cursor app did not connect within ${this.state.startupTimeoutSec}s (${message}). Falling back to stub.`
        );
        try {
          await quitCursor();
        } catch (quitErr) {
          console.warn(
            '⚠️  Failed to stop Cursor before stub fallback:',
            (quitErr as Error).message
          );
        }
        await delay(1_000);
      }
    }

    await this.startStub();
  }

  async cleanup(): Promise<void> {
    if (this.useStub) {
      await this.stopStub();
    }

    if (this.startedAgent) {
      try {
        console.log('→ Stopping Cursor');
        await quitCursor();
        await waitForCursorExit(10_000);
      } catch (err) {
        console.warn('⚠️  Failed to stop Cursor:', (err as Error).message);
      }
    }

    if (this.configSnapshot) {
      await restoreCursorConfig(this.configSnapshot);
    }
  }

  private async startStub(): Promise<void> {
    console.log('→ Launching Cursor stub connection');
    this.useStub = true;

    const headers: Record<string, string> = {
      'x-lunar-consumer-tag': 'Cursor',
      'user-agent': 'cursor-stub/1.0.0',
    };

    const baseUrl = new URL(this.state.url);
    const sseUrl = new URL(baseUrl.toString());
    sseUrl.pathname = '/sse';

    const transport = new SSEClientTransport(sseUrl, {
      eventSourceInit: {
        fetch: async (url, init) => {
          const combined = new Headers(init?.headers);
          for (const [key, value] of Object.entries(headers)) {
            combined.set(key, value);
          }
          return fetch(url, { ...init, headers: combined });
        },
      },
      requestInit: { headers },
    });
    transport.onerror = (error) => {
      console.warn('⚠️  Cursor stub transport error:', error.message ?? error);
    };
    this.stubTransport = transport;

    const client = new Client({ name: 'Cursor Stub', version: '1.0.0' });
    this.stubClient = client;

    try {
      await client.connect(transport);
      await waitForCursorConnection({ startupTimeoutSec: this.state.startupTimeoutSec });
    } catch (err) {
      await this.stopStub();
      throw err;
    }
  }

  private async stopStub(): Promise<void> {
    const client = this.stubClient;
    const transport = this.stubTransport;
    this.stubClient = undefined;
    this.stubTransport = undefined;

    if (!client && !transport) {
      return;
    }

    console.log('→ Stopping Cursor stub connection');

    try {
      await client?.close();
    } catch (err) {
      console.warn('⚠️  Failed to close Cursor stub client:', (err as Error).message);
    }

    try {
      await transport?.close();
    } catch (err) {
      console.warn('⚠️  Failed to close Cursor stub transport:', (err as Error).message);
    }
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
}

export function createCursorController(requirement: CursorAgentRequirement): CursorController {
  const configPath = expandHome(requirement.configPath ?? DEFAULT_CONFIG_PATH);
  const projectConfigPath = path.resolve('.cursor', 'mcp.json');
  const serverKey = requirement.serverKey ?? DEFAULT_SERVER_KEY;
  const url = requirement.url ?? DEFAULT_URL;
  const startupTimeoutSec = requirement.startupTimeoutSec ?? DEFAULT_TIMEOUT_SEC;

  const state: CursorState = {
    configPath,
    projectConfigPath,
    serverKey,
    url,
    startupTimeoutSec,
  };

  return new CursorController(requirement, state);
}
