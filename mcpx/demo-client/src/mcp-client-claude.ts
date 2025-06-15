import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import dotenv from "dotenv";
import readline from "readline/promises";

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

const MAX_RESPONSE_TOKENS = Number(process.env.MAX_RESPONSE_TOKENS) || 500;
const MCPX_HOST = process.env.MCPX_HOST || "http://localhost:9000";

if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

// This is a special tool that can be used to reload the tools list.
const reloadToolsTool: Tool = {
  name: "reload-tools",
  description: "reloads tools",
  input_schema: { type: "object", properties: {} },
};

const baseTools = [reloadToolsTool];

class MCPClient {
  private mcp: Client;
  private anthropic: Anthropic;
  private transport: Transport | null = null;
  private tools: Tool[] = [];

  private messages: MessageParam[] = [];

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
    this.mcp = new Client({ name: "mcpx-client", version: "1.0.0" });
  }

  async connectToServer() {
    this.transport = new SSEClientTransport(new URL(`${MCPX_HOST}/sse`));
    await this.mcp.connect(this.transport);

    const { tools } = await this.mcp.listTools();
    this.tools = [
      ...baseTools,
      ...tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      }),
    ];
    console.log(
      "Connected to server with tools:",
      this.tools.map(({ name }) => name)
    );
  }

  async processQuery(query: string) {
    this.messages.push({ role: "user", content: query });
    const finalText: string[] = [];

    let iteration = 0;
    // Keep looping until Claude returns no more tool_use
    while (true) {
      console.clear();
      iteration++;
      console.log(
        `[Iteration ${iteration}: Sending query to Claude...]`,
        JSON.stringify(this.messages, null, 2)
      );
      const response = await this.anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_RESPONSE_TOKENS,
        system: `You are a tool runner aimed at fetching information and performing tasks.
        Ask me to use the tools you have listed to solve problems.
        If you fail, explain why and supply technical information about it.
        When you ask to use a tool, mention it explicitly.
        If you are missing tool, ask me to look for a relevant one and I will try to add it.
        When a tool used, I will supply you with a summarized version of the tool output.
        If you think the task is unachievable, please let me know.
        I cannot help you other than giving you tools output upon request or adding new tools.
        Once you are done, please summarize the final result and don't request any more tools usage.`,
        messages: this.messages,
        tools: this.tools,
      });

      let didUseTool = false;

      for (const content of response.content) {
        if (content.type === "text") {
          finalText.push(content.text);
          this.messages.push({
            role: "assistant",
            content: content.text,
          });
        } else if (content.type === "tool_use") {
          console.log(
            `[Iteration ${iteration}: Claude requires to use tool ${content.name}]`,
            JSON.stringify(content)
          );
          didUseTool = true;
          const toolName = content.name;
          const toolArgs = content.input as Record<string, unknown> | undefined;

          if (toolName === reloadToolsTool.name) {
            const nextBlock = await this.handleReloadTools();
            finalText.push(nextBlock);
            break;
          } else {
            const nextBlock = await this.handleToolCall({
              toolName,
              toolArgs,
              originalQuery: query,
              iteration,
            });
            finalText.push(nextBlock);
            break;
          }
        }
      }

      // if no tool was used in this iteration, return both final text and control back to the user
      if (!didUseTool) {
        break;
      }
    }

    return finalText.join("\n");
  }

  private async handleReloadTools() {
    const { tools } = await this.mcp.listTools();
    const existingToolNames = this.tools.map((t) => t.name);
    const newToolNames = tools.map((t) => t.name);
    const addedTools = newToolNames.filter(
      (toolName) => !existingToolNames.includes(toolName)
    );
    const removedTools = existingToolNames.filter(
      (toolName) =>
        !newToolNames.includes(toolName) &&
        !baseTools.some((t) => t.name === toolName)
    );
    this.tools = [
      ...baseTools,
      ...tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
    ];
    this.messages.push({
      role: "user",
      content: "Tool reloading done, you can continue",
    });
    return `Tools reloaded. Added tools: ${addedTools.join(", ")}
    \nRemoved tools: ${removedTools.join(",")}`;
  }

  private async handleToolCall(props: {
    toolName: string;
    toolArgs: Record<string, unknown> | undefined;
    originalQuery: string;
    iteration: number;
  }) {
    const { toolName, toolArgs, originalQuery, iteration } = props;
    const toolResult = await this.mcp.callTool({
      name: toolName,
      arguments: toolArgs,
    });
    console.log(
      `Called tool ${toolName} with args ${JSON.stringify(toolArgs)}`
    );

    // ask Claude to summarize *and* tie it back to the user’s request
    // This is done to avoid sending huge tool outputs to Claude.
    const summaryResp = await this.anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      system: `You are a summarizer.
      You summarize the output of tools.
      You do not give any other information.
      Give the response back as if a tool gave it to you, just shorter and with the relevant info (according to request) only.`,
      messages: [
        {
          role: "user",
          content:
            `My original query is ${originalQuery}.\n` +
            `To accomplish that, the assistant invoked tool \`${toolName}\` with arguments:\n` +
            `\`\`\`json\n${JSON.stringify(toolArgs)}\n\`\`\`\n` +
            `Here is the raw JSON response from that tool:\n\n` +
            "```json\n" +
            JSON.stringify(toolResult.content) +
            "\n```\n\n" +
            "Please give me a concise (≤200 token) bullet‑point summary that highlights exactly what the user needs from this tool call. Don't include any other information. Just the summary of the tool's output.\n",
        },
      ],
    });

    const summary = summaryResp.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    console.log(`[Iteration ${iteration}: Claude summarized the tool output]`, {
      originalLength: JSON.stringify(toolResult.content).length,
      summaryLength: summary.length,
    });
    // feed that summary back into the conversation. Done as `user` since it is a tool output essentially.
    this.messages.push({
      role: "user",
      content: `Here is the summarized result of the call to the tool you have asked (${toolName}, with args ${JSON.stringify(
        toolArgs
      )}):\n ${summary}`,
    });

    return (
      `Tool \`${toolName}\` was called and summarized, summary output:\n` +
      summary
    );
  }

  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("MCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message = await rl.question("Query: ");
        if (!message || message.toLowerCase() === "quit") {
          break;
        }
        const response = await this.processQuery(message);
        console.log("\n\n\n***\n\n" + "Output:\n" + response);
      }
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    await this.mcp.close();
  }
}

async function main() {
  console.log("Starting MCP Client... ⚡️");
  const mcpClient = new MCPClient();
  try {
    await mcpClient.connectToServer();
    await mcpClient.chatLoop();
    console.log("Exiting MCP Client");
  } catch (e) {
    console.error("Error in MCP Client: ", e);
    console.error("Exiting...");
  } finally {
    console.log("Cleaning up...");
    await mcpClient.cleanup();
    console.log("Goodbye!");
    process.exit(0);
  }
}

main();
