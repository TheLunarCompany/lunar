import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { ChildProcess, execFile, spawn } from 'child_process';
import fs from 'fs';
import { setTimeout as delay } from 'timers/promises';
import { CursorCliAgentRequirement } from '../types';
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
const DEFAULT_COMMAND = 'cursor-agent';
const DEFAULT_LAUNCH_ARGS = ['agent'];
const DEFAULT_INSTALL_SCRIPT_URL = 'https://cursor.com/install';

interface CursorCliState {
  configPath: string;
  serverKey: string;
  url: string;
  startupTimeoutSec: number;
  command: string;
  launchArgs: string[];
  installIfMissing: boolean;
  installScriptUrl: string;
  autoLogin: boolean;
  loginArgs?: string[];
  resolvedCommand?: string;
}

export class CursorCliController implements AiAgentController {
  public readonly requirement: CursorCliAgentRequirement;
  private readonly state: CursorCliState;
  private configSnapshot?: CursorConfigSnapshot;
  private child?: ChildProcess;
  private agentReady = false;

  constructor(requirement: CursorCliAgentRequirement, state: CursorCliState) {
    this.requirement = requirement;
    this.state = state;
  }

  async prepare(): Promise<AgentPreparationResult> {
    if (!isSupportedPlatform()) {
      if (this.requirement.skipIfMissing ?? true) {
        console.warn('⚠️  Cursor CLI tests require macOS or Linux. Skipping scenario.');
        return 'skip';
      }
      throw new Error('Cursor CLI tests require macOS or Linux.');
    }

    const resolved = await this.ensureCommand();
    if (!resolved) {
      if (this.requirement.skipIfMissing ?? true) {
        console.warn('⚠️  Cursor Agent CLI not available. Skipping scenario.');
        return 'skip';
      }
      throw new Error('Cursor Agent CLI executable not found and auto-install disabled.');
    }
    this.state.resolvedCommand = resolved;

    this.configSnapshot = await ensureCursorConfig({
      configPath: this.state.configPath,
      serverKey: this.state.serverKey,
      url: this.state.url,
    });

    return 'ready';
  }

  async start(): Promise<void> {
    const command = this.state.resolvedCommand ?? this.state.command;
    console.log(`→ Launching Cursor Agent CLI: ${command} ${this.state.launchArgs.join(' ')}`);

    this.agentReady = false;

    if (this.state.autoLogin) {
      await this.tryLogin(command);
    }

    const child = spawn(command, this.state.launchArgs, {
      env: this.buildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child = child;

    child.stdout?.on('data', (chunk) => {
      process.stdout.write(`[cursor-agent] ${chunk}`);
    });
    child.stderr?.on('data', (chunk) => {
      process.stderr.write(`[cursor-agent] ${chunk}`);
    });

    let exitHandler: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
    let errorHandler: ((err: Error) => void) | undefined;
    const exitPromise = new Promise<never>((_, reject) => {
      const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
        if (!this.agentReady) {
          reject(
            new Error(
              `Cursor Agent CLI exited before connecting (code: ${code ?? 'null'}, signal: ${
                signal ?? 'null'
              })`
            )
          );
        }
      };
      const onError = (err: Error) => {
        if (!this.agentReady) {
          reject(err);
        }
      };

      exitHandler = onExit;
      errorHandler = onError;

      child.once('exit', onExit);
      child.once('error', onError);
    });

    try {
      await Promise.race([
        waitForCursorConnection({ startupTimeoutSec: this.state.startupTimeoutSec }),
        exitPromise,
      ]);
      this.agentReady = true;
    } finally {
      if (exitHandler) {
        child.off('exit', exitHandler);
      }
      if (errorHandler) {
        child.off('error', errorHandler);
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.child) {
      try {
        console.log('→ Stopping Cursor Agent CLI');
        const child = this.child;
        this.child = undefined;
        child.kill('SIGINT');
        const exited = new Promise<void>((resolve) => {
          child.once('exit', () => resolve());
        });
        await Promise.race([exited, delay(5_000)]);
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      } catch (err) {
        console.warn('⚠️  Failed to stop Cursor Agent CLI:', (err as Error).message);
      }
    }

    if (this.configSnapshot) {
      await restoreCursorConfig(this.configSnapshot);
    }
  }

  private async ensureCommand(): Promise<string | undefined> {
    const candidates = this.getCommandCandidates();

    for (const candidate of candidates) {
      const resolved = await this.tryResolveCommand(candidate);
      if (resolved) return resolved;
    }

    if (!this.state.installIfMissing) {
      return undefined;
    }

    console.log('→ Cursor Agent CLI not found. Attempting installation...');
    await this.installCursorCli();

    for (const candidate of candidates) {
      const resolved = await this.tryResolveCommand(candidate);
      if (resolved) return resolved;
    }

    return undefined;
  }

  private getCommandCandidates(): string[] {
    const { command } = this.state;
    const expanded = expandHome(command);
    const candidates = [command];
    if (expanded !== command) {
      candidates.push(expanded);
    }

    const localBin = path.join(os.homedir(), '.local', 'bin', command);
    if (!candidates.includes(localBin)) {
      candidates.push(localBin);
    }

    return candidates;
  }

  private async tryResolveCommand(candidate: string): Promise<string | undefined> {
    try {
      await execFileAsync(candidate, ['--version'], {
        env: this.buildEnv(),
        timeout: 10_000,
      });
      return candidate;
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        return undefined;
      }
      // Some paths might exist but not be executable; fall back to fs check for better logging.
      if (await fileExists(candidate)) {
        console.warn(`⚠️  Found Cursor Agent CLI at ${candidate} but could not execute it:`, err);
      }
      return undefined;
    }
  }

  private async installCursorCli(): Promise<void> {
    const scriptUrl = this.state.installScriptUrl;
    const quotedUrl = `'${scriptUrl.replace(/'/g, "'\\''")}'`;
    const cmd = `curl ${quotedUrl} -fsS | bash`;
    try {
      await execFileAsync('bash', ['-lc', cmd], {
        env: this.buildEnv(),
        maxBuffer: 20 * 1024 * 1024,
        timeout: 5 * 60_000,
      });
      console.log('✅ Cursor Agent CLI installation finished');
    } catch (err) {
      console.warn('⚠️  Cursor Agent CLI installation failed:', (err as Error).message);
    }
  }

  private buildEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    const localBin = path.join(os.homedir(), '.local', 'bin');
    const currentPath = env.PATH ?? '';
    const segments = currentPath.split(path.delimiter).filter(Boolean);
    if (!segments.includes(localBin)) {
      segments.unshift(localBin);
      env.PATH = segments.join(path.delimiter);
    }
    return env;
  }

  private async tryLogin(command: string): Promise<void> {
    const loginArgs = ['mcp', 'login', this.state.serverKey, ...(this.state.loginArgs ?? [])];
    try {
      console.log(`→ Authenticating Cursor Agent CLI against MCP server ${this.state.serverKey}`);
      await execFileAsync(command, loginArgs, {
        env: this.buildEnv(),
        maxBuffer: 5 * 1024 * 1024,
        timeout: 60_000,
      });
    } catch (err) {
      console.warn('⚠️  Cursor Agent CLI login failed (continuing):', (err as Error).message);
    }
  }
}

export function createCursorCliController(
  requirement: CursorCliAgentRequirement
): CursorCliController {
  const configPath = expandHome(requirement.configPath ?? DEFAULT_CONFIG_PATH);
  const serverKey = requirement.serverKey ?? DEFAULT_SERVER_KEY;
  const url = requirement.url ?? DEFAULT_URL;
  const startupTimeoutSec = requirement.startupTimeoutSec ?? DEFAULT_TIMEOUT_SEC;
  const command = requirement.command ?? DEFAULT_COMMAND;
  const launchArgs = requirement.launchArgs ?? DEFAULT_LAUNCH_ARGS;
  const installIfMissing = requirement.installIfMissing ?? true;
  const installScriptUrl = requirement.installScriptUrl ?? DEFAULT_INSTALL_SCRIPT_URL;
  const autoLogin = requirement.autoLogin ?? true;

  const state: CursorCliState = {
    configPath,
    serverKey,
    url,
    startupTimeoutSec,
    command,
    launchArgs,
    installIfMissing,
    installScriptUrl,
    autoLogin,
    loginArgs: requirement.loginArgs,
  };

  return new CursorCliController(requirement, state);
}

function isSupportedPlatform(): boolean {
  return process.platform === 'darwin' || process.platform === 'linux';
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.promises.access(file, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
