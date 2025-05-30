import {
  Chat,
  FunctionDeclaration,
  GoogleGenAI,
  Schema,
  Type,
} from "@google/genai";
import dotenv from "dotenv";
import { Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import readline from "readline/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
dotenv.config();

const MODEL_ID = process.env.GEMINI_MODEL_ID || "gemini-2.0-flash-exp";

const LUNAR_GATEWAY_HOST =
  process.env.LUNAR_GATEWAY_HOST || "http://localhost:8000";

const GEMINI_BASE_URL = "generativelanguage.googleapis.com";
const GEMINI_SCHEME = "https";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MCPX_HOST = process.env.MCPX_HOST || "http://localhost:9000";

function translateSchema(schema: Tool.InputSchema): Schema {
  switch (schema.type as string) {
    case "object":
      return {
        type: Type.OBJECT,
        properties: Object.fromEntries(
          Object.entries(
            schema.properties as Record<string, Tool.InputSchema>
          ).map(([key, value]) => [key, translateSchema(value)])
        ),
      };
    case "array":
      return {
        type: Type.ARRAY,
        items: translateSchema(schema.items as Tool.InputSchema),
      };
    case "string":
      return { type: Type.STRING };
    case "number":
      return { type: Type.NUMBER };
    case "integer":
      return { type: Type.INTEGER };
    case "boolean":
      return { type: Type.BOOLEAN };
    default:
      throw new Error(`Unknown schema type: ${schema.type}`);
  }
}

function translateTool(tool: Tool): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: translateSchema(tool.input_schema),
  };
}

function buildGeminiHTTPOptions() {
  const useLunarGateway = process.env.USE_LUNAR_GATEWAY
    ? process.env.USE_LUNAR_GATEWAY === "true"
    : true;

  if (!useLunarGateway) {
    return undefined;
  }
  console.log("🌖 Using Lunar Gateway 🌖", {
    host: LUNAR_GATEWAY_HOST,
    scheme: GEMINI_SCHEME,
    baseUrl: GEMINI_BASE_URL,
  });
  return {
    baseUrl: LUNAR_GATEWAY_HOST,
    headers: {
      "x-lunar-scheme": GEMINI_SCHEME,
      "x-lunar-host": GEMINI_BASE_URL,
    },
  };
}

class MCPClient {
  private mcp: Client;
  private ai: GoogleGenAI;
  private transport: Transport | null = null;

  private mainChat: Chat | null = null;
  private nextMessageToSend: string | null = null;
  private tools: FunctionDeclaration[] = [];

  constructor() {
    this.mcp = new Client({ name: "mcpx-client", version: "1.0.0" });
    this.mcp.onclose = () => {
      console.log("Connection to MCP server closed.");
    };
    this.mcp.onerror = async (error) => {
      await this.mcp.close();
      await this.connectToServer();
    };
    this.ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: buildGeminiHTTPOptions(),
    });
  }

  get toolsList() {
    return this.tools;
  }

  async connectToServer() {
    this.transport = new SSEClientTransport(new URL(`${MCPX_HOST}/sse`), {
      eventSourceInit: {
        fetch: (url, init) => {
          const headers = new Headers(init?.headers);
          headers.set(
            "x-lunar-consumer-tag",
            process.env["CONSUMER_TAG"] || "anonymous"
          );
          headers.set("x-lunar-api-key", process.env["API_KEY"] || "");
          return fetch(url, { ...init, headers });
        },
      },
    });
    await this.mcp.connect(this.transport);

    const { tools } = await this.mcp.listTools();
    this.tools = tools
      .map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      })
      .map(translateTool);
    console.log(
      "Connected to server with tools:",
      this.tools.map(({ name }) => name)
    );
  }

  async initChat(): Promise<Chat> {
    const chat = this.ai.chats.create({
      model: MODEL_ID,
      config: { tools: [{ functionDeclarations: this.tools }] },
    });

    await chat.sendMessage({
      message: `*You are a tool runner aimed at fetching information and performing tasks.
        Order me to use the tools you have listed to solve problems if you need to.
        If you fail at anything, explain why and supply technical information about it.
        When you ask to use a tool, mention it explicitly. Return a part which is a function call for that with all that is needed.
        If you can't supply the arguments to a tool, estimate if it might be possible to do so with partial arguments. If it's really impossible, tell me you can't use the tool.
        If you are missing tool, ask me to look for a relevant one and I will try to add it.
        When a tool used, I will supply you with a summarized version of the tool output.
        If you think the task is unachievable, please let me know.
        I cannot help you other than giving you tools output upon request or adding new tools.
        Once you are done, please summarize the final result and don't request any more tools usage.*`,
      config: { tools: [{ functionDeclarations: this.tools }] },
    });

    return chat;
  }

  async processQuery(query: string) {
    this.mainChat = this.mainChat || (await this.initChat());
    const finalText: string[] = [];

    let iteration = 0;
    this.nextMessageToSend = query;
    while (true) {
      // console.clear();
      iteration++;

      console.log(
        `[Iteration ${iteration}: Sending query to Model...]`
        // JSON.stringify(this.mainChat.getHistory(), null, 2)
      );

      let didUseTool = false;

      const response = await this.mainChat.sendMessage({
        message: this.nextMessageToSend,
        config: { tools: [{ functionDeclarations: this.tools }] },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        console.error(
          "No candidates found in response",
          JSON.stringify(response, null, 2)
        );
        process.exit(1);
      }
      const parts = candidate.content?.parts;
      if (!parts) {
        console.error("No parts found in response", {
          response: JSON.stringify(response, null, 2),
          history: JSON.stringify(this.mainChat.getHistory(), null, 2),
          tools: JSON.stringify(this.tools, null, 2),
        });
        process.exit(1);
      }
      for (const part of parts) {
        if (part.text) {
          finalText.push(part.text);
        } else if (part.functionCall) {
          console.log(
            `[Iteration ${iteration}: Model requires to use tool ${part.functionCall.name}]`,
            JSON.stringify(part.functionCall)
          );
          didUseTool = true;
          const toolName = part.functionCall.name;
          const toolArgs = part.functionCall.args;

          if (!toolName) {
            throw new Error("No tool name found in response"); // TODO rethink
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

      console.log(finalText.join("\n"));
      if (!didUseTool) {
        break;
      }
    }

    return finalText.join("\n");
  }

  private async handleToolCall(props: {
    toolName: string;
    toolArgs: Record<string, unknown> | undefined;
    originalQuery: string;
    iteration: number;
  }): Promise<string> {
    // await Promise.resolve(); // TODO: implement this
    // this.nextMessageToSend = "Here is the tool output";
    // return "Here is the tool output"; // TODO: implement this

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
    const systemPrompt = `You are a summarizer.
    You summarize the output of tools.
    You do not give any other information.
    Give the response back as if a tool gave it to you, just shorter and with the relevant info (according to request) only.`;

    const summaryResp = await this.ai.models.generateContent({
      model: MODEL_ID,
      contents: [
        { text: `*${systemPrompt}*` },
        {
          text:
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

    const summary = summaryResp.text || "could not summarize tool output!";

    console.log(`[Iteration ${iteration}: Model summarized the tool output]`, {
      toolName,
      toolArgs,
      originalLength: JSON.stringify(toolResult.content).length,
      summaryLength: summary.length,
    });
    // feed that summary back into the conversation. Done as `user` since it is a tool output essentially.
    this.nextMessageToSend = `Here is the summarized result of the call to the tool you have asked (${toolName}, with args ${JSON.stringify(
      toolArgs
    )}):\n ${summary}`;

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
        await this.processQuery(message);
      }
    } catch (error) {
      console.error("An error occurred:", error);
      console.log("Restarting chat loop...");
      rl.close();
      await this.chatLoop();
    } finally {
      rl.close();
    }
  }
}

async function main() {
  console.log("✨ Welcome the Google Gemini API Playground! ✨");
  const mcpClient = new MCPClient();
  await mcpClient.connectToServer().catch((error) => {
    console.log("could not connect to server", {
      error: JSON.stringify(error?.message),
    });
  });
  await mcpClient.chatLoop();
  console.log("Goodbye!");
  process.exit(0);
}
main();
