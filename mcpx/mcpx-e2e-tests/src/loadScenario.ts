// src/loadScenario.ts
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { Scenario, Step } from './types';

/**
 * Load and validate a scenario.yaml file.
 */
export function loadScenario(scenarioDir: string): Scenario {
  const file = path.join(scenarioDir, 'scenario.yaml');
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);

  const raw = yaml.load(fs.readFileSync(file, 'utf8')) as any;

  // --- basic structural checks -------------------------------------------
  if (!raw.image) throw new Error('scenario.image is required');
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error('scenario.steps must be a non-empty array');
  }

  const steps: Step[] = raw.steps.map((s: any, idx: number) => {
    if (!s.kind || !s.toolName || !s.payload || !s.expected) {
      throw new Error(`step #${idx} is missing required fields`);
    }
    return {
      name: s.name,
      kind: s.kind,
      toolName: s.toolName,
      baseUrl: s.baseUrl,
      payload: s.payload,
      expected: s.expected,
      expectError: s.expectError ?? false,
      verboseOutput: s.verboseOutput      
    };
  });

  const scenario: Scenario = {
    name: raw.name,
    image: raw.image,
    env: raw.env,
    configMount: raw.configMount,
    cleanConfigMount: raw.cleanConfigMount ?? false,
    dependentContainers: raw.dependentContainers,
    steps,
    verboseOutput: raw.verboseOutput ?? false, 
  };

  return scenario;
}

// If this file is run directly via ts-node, load & dump the scenario:
if (require.main === module) {
  const scenarioDir = process.argv[2];
  if (!scenarioDir) {
    console.error('Usage: ts-node src/loadScenario.ts <scenario-folder>');
    process.exit(1);
  }

  try {
    const cfg = loadScenario(scenarioDir);
    console.log('✅ Loaded scenario:');
    console.log(JSON.stringify(cfg, null, 2));
  } catch (err: any) {
    console.error('❌ Failed to load scenario:', err.message);
    process.exit(1);
  }
}