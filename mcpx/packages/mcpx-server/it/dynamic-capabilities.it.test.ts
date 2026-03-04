import { INTERNAL_SERVICE_NAME } from "../src/internal-tools/dynamic-capabilities.js";
import { getTestHarness, TestHarness } from "./utils.js";

const MCPX_BASE_URL = "http://localhost:9000";
const CONSUMER_TAG = "test-consumer";

function getFirstTextContent(content: unknown): string {
  const first = (content as { type: string; text: string }[])[0];
  if (first?.type === "text") {
    return first.text;
  }
  throw new Error(`Expected text content, got: ${first?.type}`);
}

describe("Dynamic Capabilities", () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = getTestHarness({
      clientConnectExtraHeaders: { "x-lunar-consumer-tag": CONSUMER_TAG },
    });
    await harness.initialize("StreamableHTTP");
  });

  afterAll(async () => {
    await harness.shutdown();
  });

  afterEach(async () => {
    // Clean up dynamic capabilities after each test
    await fetch(
      `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/disable`,
      { method: "PUT" },
    );
  });

  describe("REST API endpoints", () => {
    describe("GET /dynamic-capabilities/:consumerTag", () => {
      it("returns disabled status by default", async () => {
        const response = await fetch(
          `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}`,
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
          consumerTag: CONSUMER_TAG,
          enabled: false,
        });
      });

      it("returns enabled status after enabling", async () => {
        await fetch(
          `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
          { method: "PUT" },
        );

        const response = await fetch(
          `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}`,
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
          consumerTag: CONSUMER_TAG,
          enabled: true,
        });
      });
    });

    // Even if we don't have a connected client with a specific consumer tag,
    // we should be able to enable/disable dynamic capabilities for that tag and get the correct status
    // so when they do connect with that consumer tag, the right state will be there
    describe("works with unknown consumer tag", () => {
      const UNKNOWN_TAG = "never-seen-before-consumer";

      it("GET returns disabled for unknown consumer", async () => {
        const response = await fetch(
          `${MCPX_BASE_URL}/dynamic-capabilities/${UNKNOWN_TAG}`,
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
          consumerTag: UNKNOWN_TAG,
          enabled: false,
        });
      });

      it("PUT enable works for unknown consumer", async () => {
        const response = await fetch(
          `${MCPX_BASE_URL}/dynamic-capabilities/${UNKNOWN_TAG}/enable`,
          { method: "PUT" },
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
          consumerTag: UNKNOWN_TAG,
          enabled: true,
        });
      });
    });

    describe("PUT /dynamic-capabilities/:consumerTag/enable", () => {
      it("enables dynamic capabilities and returns status", async () => {
        const response = await fetch(
          `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
          { method: "PUT" },
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
          consumerTag: CONSUMER_TAG,
          enabled: true,
        });
      });
    });

    describe("PUT /dynamic-capabilities/:consumerTag/disable", () => {
      it("disables dynamic capabilities and returns status", async () => {
        // First enable
        await fetch(
          `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
          { method: "PUT" },
        );

        // Then disable
        const response = await fetch(
          `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/disable`,
          { method: "PUT" },
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
          consumerTag: CONSUMER_TAG,
          enabled: false,
        });
      });
    });
  });

  describe("MCP gateway integration", () => {
    it("shows internal tools when dynamic mode enabled", async () => {
      // Enable dynamic capabilities
      await fetch(
        `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
        { method: "PUT" },
      );

      const tools = await harness.client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // After enabling, should have only internal tools available
      expect(toolNames).toHaveLength(2);
      expect(toolNames).toContain(
        `${INTERNAL_SERVICE_NAME}__get_new_capabilities`,
      );
      expect(toolNames).toContain(`${INTERNAL_SERVICE_NAME}__clear_tools`);
    });

    it("does not show internal tools when dynamic mode disabled", async () => {
      const tools = await harness.client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      expect(toolNames).not.toContain(
        `${INTERNAL_SERVICE_NAME}__get_new_capabilities`,
      );
      expect(toolNames).not.toContain(`${INTERNAL_SERVICE_NAME}__clear_tools`);
    });

    it("can call get_new_capabilities and receives tool matching response", async () => {
      // Enable dynamic capabilities
      await fetch(
        `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
        { method: "PUT" },
      );

      // Call get_new_capabilities - the actual tools returned depend on LLM/Hub
      const result = await harness.client.callTool({
        name: `${INTERNAL_SERVICE_NAME}__get_new_capabilities`,
        arguments: { intent: "echo a message" },
      });

      // Verify the call succeeded and response format is correct
      expect(result.isError).toBeFalsy();
      const text = getFirstTextContent(result.content);
      // We cannot test the returned tools at the moment since it is hardcoded, soon will be LLM response so we will have more control
      expect(text).toMatch(/\d+ tools are now ready/);
    });

    it("can call clear_tools to remove added tools", async () => {
      // Enable dynamic capabilities
      await fetch(
        `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
        { method: "PUT" },
      );

      // Add tools via get_new_capabilities
      await harness.client.callTool({
        name: `${INTERNAL_SERVICE_NAME}__get_new_capabilities`,
        arguments: { intent: "echo a message" },
      });

      // Clear tools
      const result = await harness.client.callTool({
        name: `${INTERNAL_SERVICE_NAME}__clear_tools`,
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const text = getFirstTextContent(result.content);
      expect(text).toBe("Tools cleared.");

      // Verify tools were cleared
      const tools = await harness.client.listTools();
      const toolNames = tools.tools.map((t) => t.name);

      // Should only have internal tools again
      expect(toolNames).toHaveLength(2);
      expect(toolNames).toContain(
        `${INTERNAL_SERVICE_NAME}__get_new_capabilities`,
      );
      expect(toolNames).toContain(`${INTERNAL_SERVICE_NAME}__clear_tools`);
    });

    it("returns error when intent is missing", async () => {
      // Enable dynamic capabilities
      await fetch(
        `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
        { method: "PUT" },
      );

      // Call without intent
      const result = await harness.client.callTool({
        name: `${INTERNAL_SERVICE_NAME}__get_new_capabilities`,
        arguments: {},
      });

      expect(result.isError).toBe(true);
      const text = getFirstTextContent(result.content);
      expect(text).toContain("intent");
    });

    it("restores normal tool access after disabling", async () => {
      // Get initial tool count (before enabling)
      const initialTools = await harness.client.listTools();
      const initialCount = initialTools.tools.length;

      // Enable dynamic capabilities (restricts to internal tools only)
      await fetch(
        `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
        { method: "PUT" },
      );

      const restrictedTools = await harness.client.listTools();
      expect(restrictedTools.tools.length).toBe(2);

      // Disable dynamic capabilities
      await fetch(
        `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/disable`,
        { method: "PUT" },
      );

      // Should have same tools as before enabling
      const restoredTools = await harness.client.listTools();
      expect(restoredTools.tools.length).toBe(initialCount);
    });

    it("WARNING: disabling dynamic mode removes custom tool group restrictions", async () => {
      // This test documents counterintuitive behavior:
      // If a consumer had a custom tool group restriction BEFORE enabling dynamic mode,
      // disabling dynamic mode will NOT restore that restriction - they'll get all tools.

      // 1. Create a custom tool group that only allows echo-service
      await fetch(`${MCPX_BASE_URL}/config/tool-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "echo-only",
          services: { "echo-service": "*" },
        }),
      });

      // 2. Assign that tool group to the consumer (block all except echo-only)
      // Try POST first (create), if fails use PUT (update)
      const consumerConfig = {
        _type: "default-block",
        allow: ["echo-only"],
      };
      const createResp = await fetch(
        `${MCPX_BASE_URL}/config/permissions/consumers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: CONSUMER_TAG,
            config: consumerConfig,
          }),
        },
      );
      if (!createResp.ok) {
        // Consumer might already exist, try update
        await fetch(
          `${MCPX_BASE_URL}/config/permissions/consumers/${CONSUMER_TAG}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(consumerConfig),
          },
        );
      }

      // 3. Verify the consumer only sees echo-service tools
      const restrictedTools = await harness.client.listTools();
      const restrictedNames = restrictedTools.tools.map((t) => t.name);
      expect(restrictedNames.every((n) => n.startsWith("echo-service__"))).toBe(
        true,
      );
      const restrictedCount = restrictedTools.tools.length;

      // 4. Enable dynamic capabilities
      await fetch(
        `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/enable`,
        { method: "PUT" },
      );

      // 5. Disable dynamic capabilities
      await fetch(
        `${MCPX_BASE_URL}/dynamic-capabilities/${CONSUMER_TAG}/disable`,
        { method: "PUT" },
      );

      // 6. COUNTERINTUITIVE: Consumer now sees ALL tools, not just echo-service
      const afterDisableTools = await harness.client.listTools();
      expect(afterDisableTools.tools.length).toBeGreaterThan(restrictedCount);

      // Cleanup
      await fetch(`${MCPX_BASE_URL}/config/tool-groups/echo-only`, {
        method: "DELETE",
      });
    });
  });
});
