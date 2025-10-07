// src/runSingleStep.ts
import type { Step } from './types';
import { extractText } from './utils';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { AiAgentController, ToolCallableAgentController } from './aiAgents/types';

function isToolCallableAgent(
  controller?: AiAgentController
): controller is ToolCallableAgentController {
  return !!controller && typeof (controller as ToolCallableAgentController).callTool === 'function';
}

/**
 * Run ONE step and return plain text for validation.
 *  • backend  → returns concatenated text blocks from tool result
 *  • browser  → takes a snapshot after the action and returns JSON-stringified snapshot
 *  • sharedClient/transport can be used to reuse the same connection for browser steps.
 */
export async function runSingleStep(
  step: Step,
  baseUrl: string,
  sharedClient?: Client,
  sharedTransport?: SSEClientTransport,
  scenarioDefaultVerbose = false,
  agentController?: AiAgentController
): Promise<string> {
  const wantLog = step.verboseOutput ?? scenarioDefaultVerbose;

  if (step.kind === 'agent') {
    if (!isToolCallableAgent(agentController)) {
      throw new Error('Scenario requires an aiAgent that supports on-demand tool calls.');
    }
    const msg = wantLog
      ? `   → Running agent tool "${step.toolName}" with payload: ${JSON.stringify(step.payload)}`
      : `   → Running agent tool "${step.toolName}"`;
    console.log(msg);

    try {
      return await agentController.callTool({
        toolName: step.toolName,
        payload: step.payload,
        verbose: wantLog,
      });
    } catch (err: any) {
      if (step.expectError) {
        const message = err?.message ?? String(err);
        console.log(`✔ [${step.name}] expected error:`, message);
        return message;
      }
      throw err;
    }
  }

  let client: Client;
  let transport: SSEClientTransport;
  if (step.kind === 'browser') {
    // Reuse the pre-connected client/transport
    if (!sharedClient || !sharedTransport) {
      throw new Error('Browser client not initialized');
    }
    client = sharedClient;
    transport = sharedTransport;
  } else {
    // backend: create a fresh transport for /sse each time
    const url = `${baseUrl}/sse`;
    console.log(`   → Connecting to MCP server at ${url}`);
    transport = new SSEClientTransport(new URL(url));
    client = new Client({ name: 'e2e-test', version: '1.0.0' });
    await client.connect(transport);
  }

  /* ── run the requested tool ───────────────────────────────────────── */
  const msg = wantLog
    ? `   → Running ${step.kind} tool "${step.toolName}" with payload: ${JSON.stringify(
        step.payload
      )}`
    : `   → Running ${step.kind} tool "${step.toolName}"`;
  console.log(msg);

  let toolResult;
  try {
    toolResult = await client.callTool({
      name: step.toolName,
      arguments: step.payload,
    });
  } catch (err: any) {
    if (step.expectError) {
      console.log(`✔ [${step.name}] expected error:`, err.message || err);
      return err.message;
    }
    // rethrow if this wasn’t expected
    throw err;
  }

  /* ---------- browser snapshot / backend text ---------- */
  if (step.kind === 'browser') {
    // Browser tools that return text (e.g. browser_evaluate)
    const text = extractText(toolResult);
    if (wantLog && text) {
      console.log('   ← Tool output:', text.trim());
    }
    return text || '';
  }

  /* ── backend: extract raw text blocks from tool result ────────────── */
  const text = extractText(toolResult);
  if (wantLog && text) {
    console.log('   ← Tool output:', text.trim());
  }
  return text;
}
