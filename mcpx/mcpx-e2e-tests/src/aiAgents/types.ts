import type { AiAgentRequirement } from '../types';

export type AgentPreparationResult = 'ready' | 'skip';

export interface AiAgentController {
  requirement: AiAgentRequirement;
  /**
   * Prepare the environment (e.g. ensure config file, stop running instances).
   * Return 'skip' to signal that the scenario should be skipped gracefully.
   */
  prepare(): Promise<AgentPreparationResult>;
  /** Launch the agent after MCPX is ready and wait until it connects. */
  start(): Promise<void>;
  /** Restore config files / terminate processes started during the run. */
  cleanup(): Promise<void>;
}

export interface AgentToolCallOptions {
  toolName: string;
  payload: Record<string, unknown>;
  /** Optional override for the CLI method (defaults to tools/call). */
  method?: string;
  /** Log command + output for debugging. */
  verbose?: boolean;
}

export interface ToolCallableAgentController extends AiAgentController {
  callTool(options: AgentToolCallOptions): Promise<string>;
}
