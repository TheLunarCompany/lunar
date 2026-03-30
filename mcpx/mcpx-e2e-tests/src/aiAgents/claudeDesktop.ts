import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { execFile } from 'child_process';
import axios from 'axios';
import { setTimeout as delay } from 'timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ClaudeDesktopAgentRequirement } from '../types';
import { AiAgentController, AgentPreparationResult } from './types';

const execFileAsync = promisify(execFile);

const DEFAULT_CONFIG_PATH = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Claude',
  'claude_desktop_config.json'
);
const DEFAULT_SERVER_KEY = 'mcpx';
const DEFAULT_CONSUMER_TAG = 'Claude';
const DEFAULT_COMMAND = 'npx';
const DEFAULT_ARGS = [
  'mcp-remote@0.1.21',
  'http://localhost:9000/mcp',
  '--header',
  `x-lunar-consumer-tag: ${DEFAULT_CONSUMER_TAG}`,
];
const DEFAULT_TIMEOUT_SEC = 120;
const DEFAULT_MCP_URL = 'http://127.0.0.1:9000/mcp';

function expandHome(p: string): string {
  if (!p.startsWith('~')) return path.resolve(p);
  return path.resolve(path.join(os.homedir(), p.slice(1)));
}

function ensureJsonObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, any>;
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

async function quitClaude(): Promise<void> {
  try {
    await execFileAsync('osascript', ['-e', 'tell application "Claude" to quit']);
  } catch (err: any) {
    // Claude might not be running; ignore errors where osascript reports it.
    if (err?.code !== 1) {
      throw err;
    }
  }
}

async function isClaudeRunning(): Promise<boolean> {
  try {
    await execFileAsync('pgrep', ['-f', 'Claude']);
    return true;
  } catch (err: any) {
    if (err?.code === 1) return false; // pgrep returns 1 when not found
    throw err;
  }
}

async function waitForClaudeExit(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isClaudeRunning())) return;
    await delay(500);
  }
  throw new Error('Claude Desktop did not exit within the expected timeout');
}

interface ClaudeDesktopState {
  configPath: string;
  serverKey: string;
  consumerTag: string;
  command: string;
  args: string[];
  startupTimeoutSec: number;
}

export class ClaudeDesktopController implements AiAgentController {
  public readonly requirement: ClaudeDesktopAgentRequirement;
  private readonly state: ClaudeDesktopState;
  private originalConfig?: string;
  private configExisted = false;
  private startedAgent = false;
  private useStub = false;
  private stubClient?: Client;
  private stubTransport?: SSEClientTransport;

  constructor(requirement: ClaudeDesktopAgentRequirement, state: ClaudeDesktopState) {
    this.requirement = requirement;
    this.state = state;
  }

  async prepare(): Promise<AgentPreparationResult> {
    if (process.platform !== 'darwin') {
      if (this.requirement.skipIfMissing ?? true) {
        console.warn('⚠️  Claude Desktop tests require macOS. Skipping scenario.');
        return 'skip';
      }
      throw new Error('Claude Desktop tests require macOS.');
    }

    if (!(await this.detectInstallation())) {
      if (this.requirement.skipIfMissing ?? true) {
        console.warn('⚠️  Claude Desktop not detected. Skipping scenario.');
        return 'skip';
      }
      throw new Error('Claude Desktop not detected at expected locations.');
    }

    await this.ensureConfigEntry();

    // Ensure the desktop app is not currently running before we start MCPX.
    if (await isClaudeRunning()) {
      console.log('→ Claude Desktop is running, asking it to quit before the test');
      await quitClaude();
      await waitForClaudeExit(10_000);
    }

    return 'ready';
  }

  async start(): Promise<void> {
    let launched = false;
    try {
      console.log('→ Launching Claude Desktop');
      await execFileAsync('open', ['-gj', '-a', 'Claude']);
      this.startedAgent = true;
      launched = true;
      await this.waitForAgentConnection();
      return;
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      if (!launched) {
        console.warn(`⚠️  Failed to launch Claude Desktop (${message}). Falling back to stub.`);
      } else {
        console.warn(
          `⚠️  Claude Desktop did not connect within ${this.state.startupTimeoutSec}s (${message}). Falling back to stub.`
        );
        try {
          await quitClaude();
          await waitForClaudeExit(10_000);
        } catch (quitErr) {
          console.warn(
            '⚠️  Failed to stop Claude Desktop before stub fallback:',
            (quitErr as Error).message
          );
        }
        this.startedAgent = false;
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
        console.log('→ Stopping Claude Desktop');
        await quitClaude();
        await waitForClaudeExit(10_000);
      } catch (err) {
        console.warn('⚠️  Failed to stop Claude Desktop:', (err as Error).message);
      }
    }

    await this.restoreConfig();
  }

  private async detectInstallation(): Promise<boolean> {
    const candidates = [
      '/Applications/Claude.app',
      path.join(os.homedir(), 'Applications', 'Claude.app'),
      path.dirname(this.state.configPath),
    ];
    for (const candidate of candidates) {
      if (await fileExists(candidate)) return true;
    }
    return false;
  }

  private async ensureConfigEntry(): Promise<void> {
    const { configPath, serverKey, command, args } = this.state;
    const dir = path.dirname(configPath);
    if (!(await directoryExists(dir))) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    let existing: Record<string, any> = {};
    if (await fileExists(configPath)) {
      this.configExisted = true;
      this.originalConfig = await fs.promises.readFile(configPath, 'utf8');
      try {
        existing = ensureJsonObject(JSON.parse(this.originalConfig));
      } catch (err) {
        throw new Error(
          `Failed to parse existing Claude config at ${configPath}: ${(err as Error).message}`
        );
      }
    }

    const servers = ensureJsonObject(existing.mcpServers ?? {});
    servers[serverKey] = {
      command,
      args,
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
      console.warn('⚠️  Failed to restore Claude config file:', (err as Error).message);
    }
  }

  private async waitForAgentConnection(): Promise<void> {
    const { consumerTag, startupTimeoutSec } = this.state;
    const timeoutMs = startupTimeoutSec * 1000;
    const deadline = Date.now() + timeoutMs;

    console.log('→ Waiting for Claude to connect to MCPX');
    while (Date.now() < deadline) {
      try {
        const response = await axios.get('http://localhost:9000/system-state', {
          timeout: 5_000,
        });
        const clients = response.data?.connectedClients;
        if (Array.isArray(clients)) {
          const found = clients.some((client: any) => client?.consumerTag === consumerTag);
          if (found) {
            console.log('✅ Claude agent connected');
            return;
          }
        }
      } catch (err: any) {
        // Server might not be ready yet — ignore connection errors while polling
        if (err?.code !== 'ECONNREFUSED') {
          console.debug('Polling system-state failed:', err?.message ?? err);
        }
      }
      await delay(2_000);
    }

    throw new Error(
      `Timed out waiting ${startupTimeoutSec}s for Claude agent with tag "${consumerTag}" to connect`
    );
  }

  private async startStub(): Promise<void> {
    console.log('→ Launching Claude stub connection');
    this.useStub = true;

    const headers: Record<string, string> = {
      'x-lunar-consumer-tag': this.state.consumerTag,
      'user-agent': 'claude-stub/1.0.0',
    };

    const transport = new SSEClientTransport(new URL(DEFAULT_MCP_URL), {
      requestInit: { headers },
    });
    transport.onerror = (error) => {
      console.warn('⚠️  Claude stub transport error:', error.message ?? error);
    };
    this.stubTransport = transport;

    const client = new Client({ name: 'Claude Stub', version: '1.0.0' });
    this.stubClient = client;

    try {
      await client.connect(transport);
      await this.waitForAgentConnection();
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

    console.log('→ Stopping Claude stub connection');

    try {
      await client?.close();
    } catch (err) {
      console.warn('⚠️  Failed to close Claude stub client:', (err as Error).message);
    }

    try {
      await transport?.close();
    } catch (err) {
      console.warn('⚠️  Failed to close Claude stub transport:', (err as Error).message);
    }
  }
}

export function createClaudeDesktopController(
  requirement: ClaudeDesktopAgentRequirement
): ClaudeDesktopController {
  const configPath = expandHome(requirement.configPath ?? DEFAULT_CONFIG_PATH);
  const serverKey = requirement.serverKey ?? DEFAULT_SERVER_KEY;
  const consumerTag = requirement.headerTag ?? DEFAULT_CONSUMER_TAG;
  const command = requirement.command ?? DEFAULT_COMMAND;
  const args = requirement.args ?? [
    DEFAULT_ARGS[0],
    DEFAULT_ARGS[1],
    DEFAULT_ARGS[2],
    `x-lunar-consumer-tag: ${consumerTag}`,
  ];

  // Ensure the args array is copied so we don't mutate shared defaults
  const startupTimeoutSec = requirement.startupTimeoutSec ?? DEFAULT_TIMEOUT_SEC;

  const state: ClaudeDesktopState = {
    configPath,
    serverKey,
    consumerTag,
    command,
    args: [...args],
    startupTimeoutSec,
  };

  if (!state.args.includes(`x-lunar-consumer-tag: ${consumerTag}`)) {
    // Ensure the consumer tag header is present unless caller explicitly provided it.
    const hasHeader = state.args.some(
      (value) => typeof value === 'string' && value.includes('x-lunar-consumer-tag')
    );
    if (!hasHeader) {
      state.args = [...state.args, '--header', `x-lunar-consumer-tag: ${consumerTag}`];
    }
  }

  return new ClaudeDesktopController(requirement, state);
}
