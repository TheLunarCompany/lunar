import { spawn, ChildProcess, execFile } from 'child_process';
import { promisify } from 'util';
import { setTimeout as delay } from 'timers/promises';
import { McpInspectorAgentRequirement } from '../types';
import { AgentPreparationResult, AgentToolCallOptions, ToolCallableAgentController } from './types';

const execFileAsync = promisify(execFile);

const DEFAULT_COMMAND = 'npx';
const DEFAULT_PACKAGE = '@modelcontextprotocol/inspector@0.16.8';
const DEFAULT_TARGET = 'http://localhost:9000/sse';
const DEFAULT_METHOD = 'tools/list';
const DEFAULT_LOOP_DELAY_SEC = 5;
const DEFAULT_TIMEOUT_SEC = 120;

interface McpInspectorState {
  command: string;
  loopArgs: string[];
  commonArgs?: string[];
  env: NodeJS.ProcessEnv;
  loopDelayMs: number;
  startupTimeoutSec: number;
  pollingEnabled: boolean;
  logOutput: boolean;
}

export class McpInspectorController implements ToolCallableAgentController {
  public readonly requirement: McpInspectorAgentRequirement;
  private readonly state: McpInspectorState;

  private running = false;
  private loopPromise?: Promise<void>;
  private currentChild?: ChildProcess;
  private lastSuccessAt?: number;
  private lastError?: Error;

  constructor(requirement: McpInspectorAgentRequirement, state: McpInspectorState) {
    this.requirement = requirement;
    this.state = state;
  }

  async prepare(): Promise<AgentPreparationResult> {
    try {
      await execFileAsync(this.state.command, ['--version']);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        if (this.requirement.skipIfMissing ?? true) {
          console.warn('⚠️  MCP Inspector CLI (npx) not found. Skipping scenario.');
          return 'skip';
        }
        throw new Error(
          `Command "${this.state.command}" not found. MCP Inspector CLI tests require npx to be installed.`
        );
      }
      throw err;
    }

    return 'ready';
  }

  async start(): Promise<void> {
    if (!this.state.pollingEnabled) {
      console.log('→ MCP Inspector CLI polling disabled; using on-demand mode');
      return;
    }

    console.log('→ Starting MCP Inspector CLI loop');
    this.running = true;
    this.loopPromise = this.runLoop();

    const deadline = Date.now() + this.state.startupTimeoutSec * 1000;
    while (!this.lastSuccessAt) {
      if (Date.now() > deadline) {
        const details = this.lastError ? ` Last error: ${this.lastError.message}` : '';
        throw new Error(
          `Timed out waiting ${this.state.startupTimeoutSec}s for MCP Inspector CLI to complete its first invocation.${details}`
        );
      }
      await delay(500);
    }
    console.log('✅ MCP Inspector CLI connected at least once');
  }

  async cleanup(): Promise<void> {
    if (!this.running) return;
    console.log('→ Stopping MCP Inspector CLI loop');
    this.running = false;

    if (this.currentChild) {
      try {
        this.currentChild.kill('SIGINT');
      } catch (err) {
        console.warn('⚠️  Failed to send SIGINT to MCP Inspector CLI:', (err as Error).message);
      }
    }

    if (this.loopPromise) {
      try {
        await this.loopPromise;
      } catch (err) {
        console.warn('⚠️  MCP Inspector CLI loop ended with error:', (err as Error).message);
      }
    }
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.invokeCli(this.state.loopArgs);
        this.lastSuccessAt = Date.now();
        this.lastError = undefined;
      } catch (err) {
        this.lastError = err as Error;
        console.warn('⚠️  MCP Inspector CLI invocation failed:', this.lastError.message);
      }

      if (!this.running) break;
      await delay(this.state.loopDelayMs);
    }
  }

  private async invokeCli(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.state.command, args, {
        env: this.state.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.currentChild = child;

      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          if (this.state.logOutput) {
            const text = chunk.toString();
            process.stdout.write(`[mcp-inspector-cli] ${text}`);
          }
        });
      }
      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          const text = chunk.toString();
          stderr += text;
          if (this.state.logOutput) {
            process.stderr.write(`[mcp-inspector-cli] ${text}`);
          }
        });
      }

      const finish = (err?: Error) => {
        this.currentChild = undefined;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      child.once('error', finish);
      child.once('exit', (code, signal) => {
        if (!this.running && signal) {
          // Shutdown path – treat as success.
          return finish();
        }
        if (code === 0) {
          finish();
        } else {
          finish(
            new Error(
              `MCP Inspector CLI exited with code ${code ?? 'null'} (signal: ${signal ?? 'null'})${
                stderr ? ` – stderr: ${stderr.trim()}` : ''
              }`
            )
          );
        }
      });
    });
  }

  async callTool(options: AgentToolCallOptions): Promise<string> {
    if (!this.state.commonArgs) {
      throw new Error(
        'On-demand tool calls require scenario.aiAgent.args to be omitted so the runner can compose CLI arguments.'
      );
    }

    const method = options.method ?? 'tools/call';
    const cliArgs = [...this.state.commonArgs, '--method', method, '--tool-name', options.toolName];

    for (const [key, value] of Object.entries(options.payload ?? {})) {
      cliArgs.push('--tool-arg', `${key}=${formatToolArgValue(value)}`);
    }

    if (options.verbose) {
      console.log(`   → Invoking MCP Inspector CLI: ${this.state.command} ${cliArgs.join(' ')}`);
    }

    const { stdout, stderr } = await execFileAsync(this.state.command, cliArgs, {
      env: this.state.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr && options.verbose) {
      console.log(`[mcp-inspector-cli stderr] ${stderr.trim()}`);
    }

    const trimmed = stdout.trim();
    const extracted = extractTextFromCli(trimmed);
    if (options.verbose) {
      const display = extracted || trimmed;
      console.log('   ← MCP Inspector tool output:', display);
    }

    return extracted || trimmed;
  }
}

export interface McpInspectorControllerOptions {
  verboseOutput?: boolean;
}

export function createMcpInspectorController(
  requirement: McpInspectorAgentRequirement,
  options: McpInspectorControllerOptions = {}
): McpInspectorController {
  const command = requirement.command ?? DEFAULT_COMMAND;
  const target = requirement.target ?? DEFAULT_TARGET;
  const method = requirement.method ?? DEFAULT_METHOD;
  const transport = requirement.transport;

  const headers: Record<string, string> = { ...(requirement.headers ?? {}) };
  const hasConsumerTag = Object.keys(headers).some(
    (key) => key.toLowerCase() === 'x-lunar-consumer-tag'
  );
  if (!hasConsumerTag) {
    headers['x-lunar-consumer-tag'] = 'MCP Inspector CLI';
  }

  const pollingEnabled = requirement.aiAgentPolling ?? false;

  let loopArgs: string[];
  let commonArgs: string[] | undefined;
  if (requirement.args) {
    loopArgs = [...requirement.args];
  } else {
    commonArgs = ['--yes', DEFAULT_PACKAGE, '--cli', target];
    if (transport) {
      commonArgs.push('--transport', transport);
    }
    for (const [key, value] of Object.entries(headers)) {
      commonArgs.push('--header', `${key}: ${value}`);
    }

    loopArgs = [...commonArgs, '--method', method];
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(requirement.env ?? {}),
  };

  const loopDelaySec = requirement.loopDelaySec ?? DEFAULT_LOOP_DELAY_SEC;
  const loopDelayMs = Math.max(0, Math.floor(loopDelaySec * 1000));
  const startupTimeoutSec = requirement.startupTimeoutSec ?? DEFAULT_TIMEOUT_SEC;

  const state: McpInspectorState = {
    command,
    loopArgs,
    commonArgs,
    env,
    loopDelayMs,
    startupTimeoutSec,
    pollingEnabled,
    logOutput: !!options.verboseOutput,
  };

  return new McpInspectorController(requirement, state);
}

function formatToolArgValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function extractTextFromCli(stdout: string): string {
  if (!stdout) return '';

  const direct = parseContentText(stdout);
  if (direct) {
    return direct;
  }

  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const collected: string[] = [];

  for (const line of lines) {
    const text = parseContentText(line);
    if (text) {
      collected.push(text);
    }
  }

  return collected.join('');
}

function parseContentText(jsonCandidate: string): string | undefined {
  if (!jsonCandidate) return undefined;
  try {
    const parsed = JSON.parse(jsonCandidate);
    const content = resolveContentArray(parsed);
    if (!content?.length) return undefined;
    return content
      .filter(
        (block): block is { type: string; text: string } =>
          !!block &&
          typeof block === 'object' &&
          block.type === 'text' &&
          typeof block.text === 'string'
      )
      .map((block) => block.text)
      .join('');
  } catch {
    return undefined;
  }
}

function resolveContentArray(parsed: any): Array<{ type: string; text: string }> | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  if (Array.isArray(parsed.content)) return parsed.content;
  if (parsed.body && Array.isArray(parsed.body.content)) return parsed.body.content;
  if (parsed.result && Array.isArray(parsed.result.content)) return parsed.result.content;
  return undefined;
}
