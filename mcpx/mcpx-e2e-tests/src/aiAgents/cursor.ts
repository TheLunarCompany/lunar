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
  serverKey: string;
  url: string;
  startupTimeoutSec: number;
}

export class CursorController implements AiAgentController {
  public readonly requirement: CursorAgentRequirement;
  private readonly state: CursorState;
  private configSnapshot?: CursorConfigSnapshot;
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

    this.configSnapshot = await ensureCursorConfig({
      configPath: this.state.configPath,
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
    console.log('→ Launching Cursor');
    await execFileAsync('open', ['--hide', '--background', '-gj', '-a', 'Cursor']);
    this.startedAgent = true;
    await waitForCursorConnection({ startupTimeoutSec: this.state.startupTimeoutSec });
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

    if (this.configSnapshot) {
      await restoreCursorConfig(this.configSnapshot);
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
