// src/types.ts
// Type definitions for a test scenario config

import { Expectation } from './validator';

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
  steps: Step[];
}
