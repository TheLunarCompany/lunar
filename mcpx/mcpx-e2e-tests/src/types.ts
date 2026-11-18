// src/types.ts
// Type definitions for a test scenario config

import { Expectation } from './validator';

export type AiAgentType =
  | 'claude-desktop'
  | 'cursor'
  | 'cursor-cli'
  | 'gemini-cli'
  | 'mcp-inspector';

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

export interface CursorCliAgentRequirement extends AiAgentRequirementBase<'cursor-cli'> {
  /** Optional override for the Cursor MCP config JSON. */
  configPath?: string;
  /** Entry key inside the MCP servers config. Defaults to "mcpx". */
  serverKey?: string;
  /** MCP server URL to write into the Cursor config. Defaults to http://127.0.0.1:9000/mcp. */
  url?: string;
  /** Command used to launch the Cursor Agent CLI. Defaults to "cursor-agent". */
  command?: string;
  /** Arguments passed to the launch command. Defaults to ["agent"]. */
  launchArgs?: string[];
  /** Automatically install the CLI if it is missing. Defaults to true. */
  installIfMissing?: boolean;
  /** Override the installation script URL. Defaults to https://cursor.com/install. */
  installScriptUrl?: string;
  /** Attempt to authenticate / approve the MCP server before launch. Defaults to true. */
  autoLogin?: boolean;
  /** Extra arguments when invoking `cursor-agent mcp login`. */
  loginArgs?: string[];
  /** Force using the built-in stub instead of the real CLI. */
  useStub?: boolean;
  /** Allow automatically falling back to the stub when the CLI is unavailable. Defaults to true on CI. */
  allowStubFallback?: boolean;
}

export interface GeminiCliAgentRequirement extends AiAgentRequirementBase<'gemini-cli'> {
  /** Command used to launch the Gemini CLI. Defaults to `npx`. */
  command?: string;
  /** Package identifier supplied to the command (defaults to @google/gemini-cli). */
  package?: string;
  /** Additional arguments prepended before the subcommand (e.g. ['--yes']). */
  packageArgs?: string[];
  /** MCP server identifier to register (defaults to 'mcpx'). */
  serverName?: string;
  /** MCP server URL (defaults to http://127.0.0.1:9000/mcp). */
  url?: string;
  /** Transport to register the server with (defaults to 'http'). */
  transport?: 'sse' | 'http' | 'stdio';
  /** Headers to attach when registering the server. */
  headers?: Record<string, string>;
  /** Scope to use when modifying settings (defaults to 'project'). */
  scope?: 'project' | 'user';
}

export interface McpInspectorAgentRequirement extends AiAgentRequirementBase<'mcp-inspector'> {
  /** Override the command used to launch the inspector CLI (defaults to `npx`). */
  command?: string;
  /** Custom argument list supplied to the command. */
  args?: string[];
  /** Target MCP server (URL or command). Defaults to http://localhost:9000/sse. */
  target?: string;
  /** CLI method to execute. Defaults to "tools/list". */
  method?: string;
  /** Transport passed to the CLI. */
  transport?: 'sse' | 'http' | 'stdio';
  /** Optional headers forwarded to the MCP server. */
  headers?: Record<string, string>;
  /** Seconds to wait between CLI polling invocations. Defaults to 5. */
  loopDelaySec?: number;
  /** Enable background polling loop. Defaults to false; set true to watch the agent connection. */
  aiAgentPolling?: boolean;
  /** Additional environment variables for the inspector process. */
  env?: Record<string, string>;
}

export type AiAgentRequirement =
  | ClaudeDesktopAgentRequirement
  | CursorAgentRequirement
  | CursorCliAgentRequirement
  | GeminiCliAgentRequirement
  | McpInspectorAgentRequirement;

export type StepKind = 'backend' | 'browser' | 'agent';

export interface Step {
  name?: string; // Optional name for the step
  kind: StepKind; // 'backend', 'browser', or 'agent'
  toolName: string; // e.g. time__get_current_time or browser_navigate
  baseUrl?: string; // overrides host/port (9000 for backend, injected for browser)
  payload: Record<string, unknown>;
  expected: Expectation;
  expectError?: boolean; // If true, expects the MCPX to throw an error
  verboseOutput?: boolean; // (optional override)
}

export interface SlackCleanupConfig {
  channelId: string;
  textFragment: string;
  tokenEnvVar?: string;
  maxAgeMinutes?: number;
  messageLimit?: number;
}

export interface ScenarioCleanup {
  slackMessages?: SlackCleanupConfig[];
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
  cleanup?: ScenarioCleanup;
  verboseOutput?: boolean;
  disableTest?: boolean; // if true, skip this test
  expectErrorsOnStartup?: boolean; // if true, expect the MCPX to throw errors on startup
  aiAgent?: AiAgentRequirement;
  steps: Step[];
}
