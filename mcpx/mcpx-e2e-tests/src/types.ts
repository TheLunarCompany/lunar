// src/types.ts
// Type definitions for a test scenario config

import { Expectation } from './validator';

export type AiAgentType = 'claude-desktop' | 'cursor';

export interface AiAgentRequirementBase<TType extends AiAgentType = AiAgentType> {
  type: TType;
  /**
   * Skip the scenario instead of failing when the agent is not present.
   * Defaults to true so CI without the desktop agent will skip gracefully.
   */
  skipIfMissing?: boolean;
  /**
   * How long to wait (in seconds) for the agent to attach to MCPX.
   * Defaults to 120 seconds when omitted.
   */
  startupTimeoutSec?: number;
}

export interface ClaudeDesktopAgentRequirement extends AiAgentRequirementBase<'claude-desktop'> {
  /** Optional override for the Claude config JSON. */
  configPath?: string;
  /**
   * Entry name inside claude_desktop_config.json. Defaults to "mcpx".
   */
  serverKey?: string;
  /**
   * Consumer tag injected into the MCP header. Defaults to "Claude".
   */
  headerTag?: string;
  /** Override launch command arguments if needed. */
  args?: string[];
  command?: string;
}

export interface CursorAgentRequirement extends AiAgentRequirementBase<'cursor'> {
  /** Optional override for the Cursor MCP config JSON. */
  configPath?: string;
  /** Entry key inside the MCP servers config. Defaults to "mcpx". */
  serverKey?: string;
  /** MCP server URL to write into the Cursor config. Defaults to http://127.0.0.1:9000/mcp. */
  url?: string;
}

export type AiAgentRequirement = ClaudeDesktopAgentRequirement | CursorAgentRequirement;

export type StepKind = 'backend' | 'browser';

export interface Step {
  name?: string; // Optional name for the step
  kind: StepKind; // 'backend' or 'browser'
  toolName: string; // e.g. time__get_current_time or browser_navigate
  baseUrl?: string; // overrides host/port (9000 for backend, injected for browser)
  payload: Record<string, unknown>;
  expected: Expectation;
  expectError?: boolean; // If true, expects the MCPX to throw an error
  verboseOutput?: boolean; // (optional override)
}

/** Optional dependent container */
export interface DependentContainer {
  name: string;
  image: string;

  /** If need to override the image’s default entrypoint */
  command?: string;
  /** Arguments passed to that command */
  args?: string[];

  /** e.g. ['3002:3002'] */
  ports?: string[];
  env?: Record<string, string>;

  /** Run the container as --privileged (needed for docker:dind) */
  privileged?: boolean;
}

/** The root scenario configuration loaded from YAML. */
export interface Scenario {
  // Optional name for the scenario
  name?: string;
  // Docker image under test
  image: string;
  // Env vars for the container
  env?: Record<string, string>;
  // (Optional) directory to mount as MCPX config
  configMount?: string;
  cleanConfigMount?: boolean; // if true, files produced by the test will be cleaned up
  // Other containers to start first
  dependentContainers?: DependentContainer[];
  verboseOutput?: boolean;
  disableTest?: boolean; // if true, skip this test
  expectErrorsOnStartup?: boolean; // if true, expect the MCPX to throw errors on startup
  aiAgent?: AiAgentRequirement;
  steps: Step[];
}
