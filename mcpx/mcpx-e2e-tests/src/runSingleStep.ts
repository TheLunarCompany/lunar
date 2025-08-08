// src/runSingleStep.ts
import { Step } from './types';
import { extractText } from './utils';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client }             from '@modelcontextprotocol/sdk/client/index.js';


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
  scenarioDefaultVerbose = false
): Promise<string> {
  const wantLog = step.verboseOutput ?? scenarioDefaultVerbose;

  let client: Client;
  let transport: SSEClientTransport;
  if (step.kind === 'browser') {
    // Reuse the pre-connected client/transport
    if (!sharedClient || !sharedTransport) {
      throw new Error('Browser client not initialized');
    }
    client    = sharedClient;
    transport = sharedTransport;
  } else {
    // backend: create a fresh transport for /sse each time
    const url = `${baseUrl}/sse`;
    console.log(`   → Connecting to MCP server at ${url}`); 
    transport = new SSEClientTransport(new URL(url));
    client    = new Client({ name: 'e2e-test', version: '1.0.0' });
    await client.connect(transport);
  }
    
  /* ── run the requested tool ───────────────────────────────────────── */  
  const msg = wantLog
    ? `   → Running ${step.kind} tool "${step.toolName}" with payload: ${JSON.stringify(step.payload)}`
    : `   → Running ${step.kind} tool "${step.toolName}"`;
  console.log(msg);

  let toolResult;
  try {
    toolResult = await client.callTool({
      name      : step.toolName,
      arguments : step.payload,
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

