import {
  AiAgentRequirement,
  ClaudeDesktopAgentRequirement,
  CursorAgentRequirement,
} from '../types';
import { AiAgentController } from './types';
import { createClaudeDesktopController } from './claudeDesktop';
import { createCursorController } from './cursor';

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
  switch (type) {
    case 'claude-desktop': {
      const req: ClaudeDesktopAgentRequirement = {
        type: 'claude-desktop',
        skipIfMissing:
          candidate.skipIfMissing === undefined ? undefined : Boolean(candidate.skipIfMissing),
        startupTimeoutSec:
          candidate.startupTimeoutSec === undefined
            ? undefined
            : Number(candidate.startupTimeoutSec),
        configPath: typeof candidate.configPath === 'string' ? candidate.configPath : undefined,
        serverKey: typeof candidate.serverKey === 'string' ? candidate.serverKey : undefined,
        headerTag: typeof candidate.headerTag === 'string' ? candidate.headerTag : undefined,
        command: typeof candidate.command === 'string' ? candidate.command : undefined,
        args: candidate.args === undefined ? undefined : parseArgsArray(candidate.args),
      };
      if (req.startupTimeoutSec !== undefined && Number.isNaN(req.startupTimeoutSec)) {
        throw new Error('scenario.aiAgent.startupTimeoutSec must be a number if provided');
      }
      return req;
    }
    case 'cursor': {
      const req: CursorAgentRequirement = {
        type: 'cursor',
        skipIfMissing:
          candidate.skipIfMissing === undefined ? undefined : Boolean(candidate.skipIfMissing),
        startupTimeoutSec:
          candidate.startupTimeoutSec === undefined
            ? undefined
            : Number(candidate.startupTimeoutSec),
        configPath: typeof candidate.configPath === 'string' ? candidate.configPath : undefined,
        serverKey: typeof candidate.serverKey === 'string' ? candidate.serverKey : undefined,
        url: typeof candidate.url === 'string' ? candidate.url : undefined,
      };
      if (req.startupTimeoutSec !== undefined && Number.isNaN(req.startupTimeoutSec)) {
        throw new Error('scenario.aiAgent.startupTimeoutSec must be a number if provided');
      }
      return req;
    }
    default:
      throw new Error(`Unsupported aiAgent type: ${type}`);
  }
}

function parseArgsArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('scenario.aiAgent.args must be an array of strings');
  }
  return value.map((entry, idx) => {
    if (typeof entry !== 'string') {
      throw new Error(`scenario.aiAgent.args[${idx}] must be a string`);
    }
    return entry;
  });
}

export function createAgentController(requirement: AiAgentRequirement): AiAgentController {
  switch (requirement.type) {
    case 'claude-desktop':
      return createClaudeDesktopController(requirement);
    case 'cursor':
      return createCursorController(requirement);
    default: {
      const { type } = requirement as { type: string };
      throw new Error(`Unsupported aiAgent type: ${type ?? 'unknown'}`);
    }
  }
}
export type { AiAgentController } from './types';
