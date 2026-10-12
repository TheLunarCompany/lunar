import {
  AiAgentRequirement,
  ClaudeDesktopAgentRequirement,
  CursorAgentRequirement,
  CursorCliAgentRequirement,
  GeminiCliAgentRequirement,
  McpInspectorAgentRequirement,
} from '../types';
import { AiAgentController } from './types';
import { createClaudeDesktopController } from './claudeDesktop';
import { createCursorController } from './cursor';
import { createCursorCliController } from './cursorCli';
import { createGeminiCliController } from './geminiCli';
import { createMcpInspectorController } from './mcpInspector';

interface AgentBaseFields {
  skipIfMissing?: boolean;
  startupTimeoutSec?: number;
}

export function parseAiAgentRequirement(raw: unknown): AiAgentRequirement | undefined {
  if (!raw) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('scenario.aiAgent must be an object when provided');
  }
  const candidate = raw as Record<string, unknown>;
  const { type } = candidate;
  if (typeof type !== 'string') {
    throw new Error('scenario.aiAgent.type must be a string when provided');
  }
  const base = parseAgentBaseFields(candidate);
  switch (type) {
    case 'claude-desktop': {
      const req: ClaudeDesktopAgentRequirement = {
        type: 'claude-desktop',
        ...base,
        configPath: optionalString(candidate.configPath),
        serverKey: optionalString(candidate.serverKey),
        headerTag: optionalString(candidate.headerTag),
        command: optionalString(candidate.command),
        args: parseOptionalArgs(candidate.args),
      };
      return req;
    }
    case 'cursor': {
      const req: CursorAgentRequirement = {
        type: 'cursor',
        ...base,
        configPath: optionalString(candidate.configPath),
        serverKey: optionalString(candidate.serverKey),
        url: optionalString(candidate.url),
      };
      return req;
    }
    case 'cursor-cli': {
      const req: CursorCliAgentRequirement = {
        type: 'cursor-cli',
        ...base,
        configPath: optionalString(candidate.configPath),
        serverKey: optionalString(candidate.serverKey),
        url: optionalString(candidate.url),
        command: optionalString(candidate.command),
        launchArgs: parseOptionalStringArray(candidate.launchArgs, 'scenario.aiAgent.launchArgs'),
        installIfMissing: parseOptionalBoolean(
          candidate.installIfMissing,
          'scenario.aiAgent.installIfMissing'
        ),
        installScriptUrl: optionalString(candidate.installScriptUrl),
        autoLogin: parseOptionalBoolean(candidate.autoLogin, 'scenario.aiAgent.autoLogin'),
        loginArgs: parseOptionalStringArray(candidate.loginArgs, 'scenario.aiAgent.loginArgs'),
        useStub: parseOptionalBoolean(candidate.useStub, 'scenario.aiAgent.useStub'),
        allowStubFallback: parseOptionalBoolean(
          candidate.allowStubFallback,
          'scenario.aiAgent.allowStubFallback'
        ),
      };
      return req;
    }
    case 'gemini-cli': {
      const req: GeminiCliAgentRequirement = {
        type: 'gemini-cli',
        ...base,
        command: optionalString(candidate.command),
        package: optionalString(candidate.package),
        packageArgs: parseOptionalStringArray(
          candidate.packageArgs,
          'scenario.aiAgent.packageArgs'
        ),
        serverName: optionalString(candidate.serverName),
        url: optionalString(candidate.url),
        headers: parseHeaders(candidate.headers),
        scope: optionalScope(candidate.scope),
      };
      return req;
    }
    case 'mcp-inspector': {
      const req: McpInspectorAgentRequirement = {
        type: 'mcp-inspector',
        ...base,
        command: optionalString(candidate.command),
        args: parseOptionalArgs(candidate.args),
        target: optionalString(candidate.target),
        method: optionalString(candidate.method),
        transport: parseTransport(candidate.transport),
        headers: parseHeaders(candidate.headers),
        loopDelaySec: parseOptionalNumber(candidate.loopDelaySec, 'scenario.aiAgent.loopDelaySec'),
        aiAgentPolling: parseOptionalBoolean(
          candidate.aiAgentPolling,
          'scenario.aiAgent.aiAgentPolling'
        ),
        env: parseEnvMap(candidate.env),
      };
      return req;
    }
    default:
      throw new Error(`Unsupported aiAgent type: ${type}`);
  }
}

function parseAgentBaseFields(candidate: Record<string, unknown>): AgentBaseFields {
  const base: AgentBaseFields = {};
  if (candidate.skipIfMissing !== undefined) {
    base.skipIfMissing = Boolean(candidate.skipIfMissing);
  }
  const startupTimeoutSec = parseOptionalNumber(
    candidate.startupTimeoutSec,
    'scenario.aiAgent.startupTimeoutSec'
  );
  if (startupTimeoutSec !== undefined) {
    base.startupTimeoutSec = startupTimeoutSec;
  }
  return base;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseOptionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    throw new Error(`${field} must be a number if provided`);
  }
  return numeric;
}

function parseOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  return parseBoolean(value, field);
}

function parseOptionalArgs(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  return parseArgsArray(value);
}

function parseOptionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  return parseStringArray(value, field);
}

function parseArgsArray(value: unknown): string[] {
  return parseStringArray(value, 'scenario.aiAgent.args');
}

export interface CreateAgentControllerOptions {
  verboseOutput?: boolean;
}

export function createAgentController(
  requirement: AiAgentRequirement,
  options: CreateAgentControllerOptions = {}
): AiAgentController {
  switch (requirement.type) {
    case 'claude-desktop':
      return createClaudeDesktopController(requirement);
    case 'cursor':
      return createCursorController(requirement);
    case 'cursor-cli':
      return createCursorCliController(requirement);
    case 'gemini-cli':
      return createGeminiCliController(requirement);
    case 'mcp-inspector':
      return createMcpInspectorController(requirement, options);
    default: {
      const { type } = requirement as { type: string };
      throw new Error(`Unsupported aiAgent type: ${type ?? 'unknown'}`);
    }
  }
}
export type { AiAgentController } from './types';

function parseEnvMap(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('scenario.aiAgent.env must be an object when provided');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const result: Record<string, string> = {};
  for (const [key, entryValue] of entries) {
    if (typeof entryValue !== 'string') {
      throw new Error(`scenario.aiAgent.env.${key} must be a string`);
    }
    result[key] = entryValue;
  }
  return result;
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value.map((entry, idx) => {
    if (typeof entry !== 'string') {
      throw new Error(`${field}[${idx}] must be a string`);
    }
    return entry;
  });
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  throw new Error(`${field} must be a boolean when provided`);
}

function parseTransport(value: unknown): 'sse' | 'http' | 'stdio' | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error('scenario.aiAgent.transport must be a string when provided');
  }
  if (value !== 'sse' && value !== 'http' && value !== 'stdio') {
    throw new Error('scenario.aiAgent.transport must be one of "sse", "http", or "stdio"');
  }
  return value;
}

function parseHeaders(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('scenario.aiAgent.headers must be an object when provided');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const result: Record<string, string> = {};
  for (const [key, entryValue] of entries) {
    if (typeof entryValue !== 'string') {
      throw new Error(`scenario.aiAgent.headers.${key} must be a string`);
    }
    result[key] = entryValue;
  }
  return result;
}

function optionalScope(value: unknown): 'project' | 'user' | undefined {
  if (value === undefined) return undefined;
  if (value === 'project' || value === 'user') {
    return value;
  }
  throw new Error('scenario.aiAgent.scope must be either "project" or "user" when provided');
}
