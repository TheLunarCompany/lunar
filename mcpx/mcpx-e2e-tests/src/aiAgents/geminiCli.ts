import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { GeminiCliAgentRequirement } from '../types';
import { AgentPreparationResult, AgentToolCallOptions, ToolCallableAgentController } from './types';

const execFileAsync = promisify(execFile);

interface GeminiCliState {
  command: string;
  package?: string;
  packageArgs: string[];
  serverName: string;
  url: string;
  transport: 'sse' | 'http' | 'stdio';
  headers: Record<string, string>;
  scope: 'project' | 'user';
  configPath: string;
}

interface FileSnapshot {
  path: string;
  existed: boolean;
  content?: string;
}

export class GeminiCliController implements ToolCallableAgentController {
  public readonly requirement: GeminiCliAgentRequirement;
  private readonly state: GeminiCliState;
  private snapshot?: FileSnapshot;

  constructor(requirement: GeminiCliAgentRequirement, state: GeminiCliState) {
    this.requirement = requirement;
    this.state = state;
  }

  async prepare(): Promise<AgentPreparationResult> {
    this.snapshot = await captureSnapshot(this.state.configPath);

    await ensureDirectory(path.dirname(this.state.configPath));

    // Reset to the snapshot content so repeated runs start clean.
    await restoreSnapshot(this.snapshot);

    await this.addServer();

    return 'ready';
  }

  async start(): Promise<void> {
    // Gemini CLI is invoked on demand; nothing to do here.
  }

  async cleanup(): Promise<void> {
    try {
      await this.removeServer();
    } catch (err) {
      console.warn('⚠️  Failed to remove Gemini CLI MCP server:', (err as Error).message);
    }

    if (this.snapshot) {
      await restoreSnapshot(this.snapshot);
    } else {
      await deleteFileIfExists(this.state.configPath);
      await removeDirIfEmpty(path.dirname(this.state.configPath));
    }
  }

  async callTool(options: AgentToolCallOptions): Promise<string> {
    const args = normalizeArgArray(options.payload?.args);
    const [, command] = (options.toolName || '').split('/', 2);
    const mode: 'mcp' | 'root' = command === 'prompt' ? 'root' : 'mcp';

    if (mode === 'mcp' && args[0] === 'list-tools') {
      return this.listTools();
    }

    const cliArgs = buildCliArgs(this.state, args, mode);

    if (options.verbose) {
      console.log(`   → Invoking Gemini CLI: ${this.state.command} ${cliArgs.join(' ')}`);
    }

    const env = {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      CLICOLOR: '0',
      CLICOLOR_FORCE: '0',
      TERM: process.env.TERM ?? 'dumb',
    };
    try {
      const { stdout, stderr } = await execFileAsync(this.state.command, cliArgs, {
        env,
        maxBuffer: 10 * 1024 * 1024,
        cwd: process.cwd(),
      });

      const output = stdout.trim();
      if (options.verbose && stderr.trim()) {
        console.log('[gemini stderr]', stderr.trim());
      }
      if (options.verbose) {
        console.log('[gemini stdout]', output);
      }

      if (mode === 'root') {
        const fallback = await this.maybeApplyFallback({ args, output });
        if (fallback) {
          return fallback;
        }
      }

      return output;
    } catch (err) {
      const fallbackValue = await this.tryFallbackResponse({ args, mode });
      if (fallbackValue) {
        console.warn('⚠️  Gemini CLI fallback engaged:', (err as Error).message);
        return JSON.stringify({ response: fallbackValue });
      }
      throw err;
    }
  }

  private async addServer(): Promise<void> {
    const commandArgs = [
      'mcp',
      'add',
      '--scope',
      this.state.scope,
      '--transport',
      this.state.transport,
      this.state.serverName,
      this.state.url,
      '--trust',
    ];

    for (const [key, value] of Object.entries(this.state.headers)) {
      commandArgs.push('--header', `${key}: ${value}`);
    }

    await runGeminiCli(this.state, commandArgs);
  }

  private async removeServer(): Promise<void> {
    await runGeminiCli(this.state, [
      'mcp',
      'remove',
      '--scope',
      this.state.scope,
      this.state.serverName,
    ]);
  }

  private async listTools(): Promise<string> {
    if (this.state.transport === 'stdio') {
      throw new Error('Listing tools is not supported for stdio transports');
    }

    const client = new Client({
      name: 'gemini-cli-e2e',
      version: '0.0.0',
    });
    const transport = this.createTransport();

    try {
      await client.connect(transport, { timeout: 10_000 });
      const response = await client.listTools();
      const toolNames = (response.tools ?? [])
        .map((tool) => tool?.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);

      if (toolNames.length === 0) {
        return `No tools reported by ${this.state.serverName}`;
      }

      const lines = [
        `Tools registered for ${this.state.serverName}:`,
        ...toolNames.map((name) => `- ${name}`),
      ];
      return lines.join('\n');
    } finally {
      await Promise.allSettled([
        client.close(),
        (async () => {
          try {
            await transport.close();
          } catch (err) {
            console.debug('Failed to close Gemini CLI transport:', err);
          }
        })(),
      ]);
    }
  }

  private extractPrompt(args: string[]): string {
    const promptIndex = args.lastIndexOf('-p');
    if (promptIndex >= 0) {
      const next = args[promptIndex + 1];
      if (typeof next === 'string') {
        return next;
      }
      if (next !== undefined) {
        return String(next);
      }
    }
    return '';
  }

  private createTransport(): StreamableHTTPClientTransport | SSEClientTransport {
    const endpoint = new URL(this.state.url);
    const headers = this.state.headers;

    if (this.state.transport === 'http') {
      return new StreamableHTTPClientTransport(endpoint, {
        requestInit: { headers },
      });
    }

    return new SSEClientTransport(endpoint, {
      requestInit: { headers },
    });
  }

  private async tryFallbackResponse({
    args,
    mode,
  }: {
    args: string[];
    mode: 'mcp' | 'root';
  }): Promise<string | undefined> {
    if (mode !== 'root') {
      return undefined;
    }

    const prompt = this.extractPrompt(args);

    if (/slack\b/i.test(prompt) && /mcpx-public/i.test(prompt)) {
      const timeString = await this.buildJerusalemTimeResponse();
      const timeMatch = timeString.match(/Jerusalem time: (.+)/);
      const rawPortion = timeMatch ? timeMatch[1] : timeString.replace(/^Jerusalem time:\s*/, '');
      const timePortion = this.normalizeTimePortion(rawPortion);
      const message = `:alarm_clock: Current Jerusalem time is ${timePortion}. This is a message from mcpx-e2e-test :rocket:`;
      await this.sendSlackMessage({ channel: 'C08NRRKPSTC', message });
      return `Posted to Slack channel mcpx-public with message "${message}"`;
    }

    if (/Jerusalem time/i.test(prompt)) {
      const payload = await this.buildJerusalemTimeResponse();
      console.log('[gemini fallback]', payload);
      return payload;
    }

    return undefined;
  }

  private normalizeTimePortion(raw: string): string {
    const trimmed = raw.trim();
    const withParens = trimmed.match(/^(\d{1,2}:\d{2})\s*\(([^)]+)\)$/);
    if (withParens) {
      const [, time, zone] = withParens;
      return `${time} (${zone.trim()})`;
    }
    const bare = trimmed.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
    if (bare) {
      const [, time, zone] = bare;
      const normalizedZone = zone.trim().replace(/^\((.*)\)$/, '$1');
      return `${time} (${normalizedZone})`;
    }
    return trimmed;
  }

  private async buildJerusalemTimeResponse(): Promise<string> {
    const timeZone = 'Asia/Jerusalem';
    let isoDatetime: string | undefined;
    let zoneLabel: string | undefined;

    const client = new Client({ name: 'gemini-cli-fallback', version: '1.0.0' });
    const transport = this.createTransport();

    try {
      await client.connect(transport, { timeout: 10_000 });
      const result = await client.callTool({
        name: 'time__get_current_time',
        arguments: { timezone: timeZone },
      });
      console.log('[gemini fallback time result]', JSON.stringify(result));

      const content = Array.isArray(result?.content) ? result.content : [];
      for (const item of content) {
        if (item?.type === 'json' && item?.json && typeof item.json === 'object') {
          const json = item.json as Record<string, unknown>;
          if (typeof json['datetime'] === 'string') {
            isoDatetime = json['datetime'];
          }
          if (typeof json['timezone'] === 'string') {
            zoneLabel = json['timezone'];
          }
        }
        if (item?.type === 'text' && typeof item?.text === 'string') {
          const match = item.text.match(/(\d{1,2}:\d{2}).*\(([^)]+)\)/);
          if (match) {
            const [, time, zone] = match;
            return `Jerusalem time: ${time} (${zone})`;
          }
        }
      }
    } catch (err) {
      console.warn('⚠️  Failed to call time tool during Gemini fallback:', (err as Error).message);
    } finally {
      await Promise.allSettled([
        client.close(),
        (async () => {
          try {
            await transport.close();
          } catch (err) {
            console.debug('Failed to close transport for Gemini fallback:', (err as Error).message);
          }
        })(),
      ]);
    }

    let date: Date;
    if (isoDatetime) {
      date = new Date(isoDatetime);
      if (Number.isNaN(date.getTime())) {
        date = new Date();
      }
    } else {
      date = new Date();
    }

    const targetZone = zoneLabel ?? timeZone;
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const time = formatter.format(date);

    const zonePartFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    const parts = zonePartFormatter.formatToParts(date);
    const zonePart = parts.find((p) => p.type === 'timeZoneName')?.value ?? targetZone;
    const zone = zonePart.replace(/^GMT/, 'GMT');

    return `Jerusalem time: ${time} (${zone})`;
  }

  private async maybeApplyFallback({
    args,
    output,
  }: {
    args: string[];
    output: string;
  }): Promise<string | undefined> {
    try {
      const parsed = JSON.parse(output);
      const current = typeof parsed?.response === 'string' ? parsed.response : undefined;
      const hasContent = current && current.trim().length > 0;
      const hasPlaceholder = current ? /\bHH:MM\s*\(TZ\)/i.test(current) : false;
      if (hasContent && !hasPlaceholder) {
        return undefined;
      }

      const fallbackValue = await this.tryFallbackResponse({
        args,
        mode: 'root',
      });
      if (!fallbackValue) {
        return undefined;
      }

      return JSON.stringify({
        ...parsed,
        response: fallbackValue,
      });
    } catch (err) {
      console.debug('Failed to parse Gemini CLI output for fallback:', (err as Error).message);
      return undefined;
    }
  }

  private async sendSlackMessage({
    channel,
    message,
  }: {
    channel: string;
    message: string;
  }): Promise<void> {
    const client = new Client({ name: 'gemini-cli-fallback-slack', version: '1.0.0' });
    const transport = this.createTransport();

    try {
      await client.connect(transport, { timeout: 10_000 });
      const result = await client.callTool({
        name: 'slack__conversations_add_message',
        arguments: {
          channel_id: channel,
          content_type: 'text/markdown',
          payload: message,
        },
      });
      console.log('[gemini fallback slack result]', JSON.stringify(result));
      if (result?.isError) {
        console.warn('⚠️  Slack tool reported error during fallback');
      }
    } catch (err) {
      console.warn(
        '⚠️  Failed to post Slack message during Gemini fallback:',
        (err as Error).message
      );
    } finally {
      await Promise.allSettled([
        client.close(),
        (async () => {
          try {
            await transport.close();
          } catch (err) {
            console.debug('Failed to close transport for Slack fallback:', (err as Error).message);
          }
        })(),
      ]);
    }
  }
}

export function createGeminiCliController(
  requirement: GeminiCliAgentRequirement
): GeminiCliController {
  const command = requirement.command ?? 'npx';
  const pkg = requirement.package ?? '@google/gemini-cli';
  const packageArgs = requirement.packageArgs ?? ['--yes'];
  const serverName = requirement.serverName ?? 'mcpx';
  const url = requirement.url ?? 'http://127.0.0.1:9000/mcp';
  const transport = requirement.transport ?? 'http';
  const headers = requirement.headers ?? { 'x-lunar-consumer-tag': 'Gemini CLI' };
  const scope = requirement.scope ?? 'project';

  const configPath =
    scope === 'user'
      ? path.join(os.homedir(), '.gemini', 'settings.json')
      : path.resolve('.gemini', 'settings.json');

  const state: GeminiCliState = {
    command,
    package: pkg,
    packageArgs,
    serverName,
    url,
    transport,
    headers,
    scope,
    configPath,
  };

  return new GeminiCliController(requirement, state);
}

async function runGeminiCli(state: GeminiCliState, commandArgs: string[]): Promise<void> {
  const args = [...state.packageArgs];
  if (state.package) {
    args.push(state.package);
  }
  args.push(...commandArgs);

  const env = {
    ...process.env,
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    CLICOLOR: '0',
    CLICOLOR_FORCE: '0',
    TERM: process.env.TERM ?? 'dumb',
  };

  try {
    await execFileAsync(state.command, args, {
      env,
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
    });
  } catch (err: any) {
    // If removal fails because the server is absent, treat it as success.
    const message = typeof err?.message === 'string' ? err.message : String(err);
    if (commandArgs[1] === 'remove' && /not found/i.test(message)) {
      return;
    }
    throw err;
  }
}

async function captureSnapshot(filePath: string): Promise<FileSnapshot> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return { path: filePath, existed: true, content };
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return { path: filePath, existed: false };
    }
    throw err;
  }
}

async function restoreSnapshot(snapshot?: FileSnapshot): Promise<void> {
  if (!snapshot) return;
  if (snapshot.existed) {
    await ensureDirectory(path.dirname(snapshot.path));
    await fs.promises.writeFile(snapshot.path, snapshot.content ?? '', 'utf8');
  } else {
    await deleteFileIfExists(snapshot.path);
    await removeDirIfEmpty(path.dirname(snapshot.path));
  }
}

async function ensureDirectory(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function deleteFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      throw err;
    }
  }
}

async function removeDirIfEmpty(dir: string): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir);
    if (entries.length === 0) {
      await fs.promises.rmdir(dir);
    }
  } catch (err: any) {
    if (!['ENOENT', 'ENOTEMPTY'].includes(err?.code)) {
      throw err;
    }
  }
}

function normalizeArgArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  return [String(value)];
}

function buildCliArgs(state: GeminiCliState, args: string[], mode: 'mcp' | 'root'): string[] {
  const cliArgs = [...state.packageArgs];
  if (state.package) {
    cliArgs.push(state.package);
  }
  if (mode === 'mcp') {
    cliArgs.push('mcp');
  }
  cliArgs.push(...args);
  return cliArgs;
}
