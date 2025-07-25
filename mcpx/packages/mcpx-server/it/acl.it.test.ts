import {
  PermissionsConfig,
  ToolGroup,
} from "../src/model/config/permissions.js";
import {
  buildConfig,
  getTestHarness,
  TestHarness,
  transportTypes,
} from "./utils.js";

describe.each(transportTypes)("ACL over %s Router", (transportType) => {
  const toolGroups: ToolGroup[] = [
    { name: "admin", services: { "calculator-service": ["powerOfTwo"] } },
    { name: "read-only", services: { "echo-service": ["echo"] } },
  ];
  const permissions: PermissionsConfig = {
    default: { _type: "default-block", allow: [] },
    consumers: {
      "power-users": {
        _type: "default-allow",
        block: ["admin"],
      },
      guests: {
        _type: "default-block",
        allow: ["read-only"],
      },
    },
  };
  // Define the cases for testing ACL behavior
  interface Invocation {
    _type: "success" | "failed";
    name: string;
    params: Record<string, unknown>;
    response: string;
  }

  function buildEchoInvocation(_type: "success" | "failed"): Invocation {
    return {
      _type,
      name: "echo-service__echo",
      params: { message: "The sound of silence?" },
      response: "Tool echo: The sound of silence?",
    };
  }
  function buildAddInvocation(_type: "success" | "failed"): Invocation {
    return {
      _type,
      name: "calculator-service__add",
      params: { a: 5, b: 2 },
      response: "Result: 7",
    };
  }

  function buildPowerOfTwoInvocation(_type: "success" | "failed"): Invocation {
    return {
      _type,
      name: "calculator-service__powerOfTwo",
      params: { base: 4 },
      response: "Result: 16",
    };
  }

  interface Case {
    headers: { "x-lunar-consumer-tag"?: string };
    visibleTools: string[];
    invocations: Invocation[];
  }
  const cases: Case[] = [
    {
      headers: {},
      visibleTools: [],
      invocations: [
        buildAddInvocation("failed"),
        buildPowerOfTwoInvocation("failed"),
        buildEchoInvocation("failed"),
      ],
    },
    {
      headers: { "x-lunar-consumer-tag": "unrelated" },
      visibleTools: [],
      invocations: [
        buildAddInvocation("failed"),
        buildPowerOfTwoInvocation("failed"),
        buildEchoInvocation("failed"),
      ],
    },
    {
      headers: { "x-lunar-consumer-tag": "power-users" },
      visibleTools: ["calculator-service__add", "echo-service__echo"], // Order is alphabetical so this should not be flaky
      invocations: [
        buildAddInvocation("success"),
        buildPowerOfTwoInvocation("failed"),
        buildEchoInvocation("success"),
      ],
    },
    {
      headers: { "x-lunar-consumer-tag": "guests" },
      visibleTools: ["echo-service__echo"],
      invocations: [
        buildAddInvocation("failed"),
        buildPowerOfTwoInvocation("failed"),
        buildEchoInvocation("success"),
      ],
    },
  ];
  cases.forEach(({ headers, visibleTools, invocations }) => {
    describe(`when consumer tag header is "${headers["x-lunar-consumer-tag"] || "not passed"}"`, () => {
      let testHarness: TestHarness;
      beforeEach(async () => {
        const config = buildConfig({ toolGroups, permissions });
        testHarness = getTestHarness({
          config,
          clientConnectExtraHeaders: headers,
        });
        await testHarness.initialize(transportType);
      });

      afterEach(async () => {
        await testHarness.shutdown();
      });

      it("lists only allowed tools", async () => {
        const tools = await testHarness.client.listTools();
        expect(tools.tools.map((t) => t.name)).toEqual(visibleTools);
      });

      it("allows calling only allowed tools", async () => {
        await Promise.all(
          invocations.map(async (invocation) => {
            const { name, params, response, _type } = invocation;
            if (_type === "failed") {
              return;
            }

            const res = await testHarness.client.callTool({
              name,
              arguments: params,
            });
            const result = (res.content as [{ text: string }])[0];
            expect(result.text).toEqual(response);
          }),
        );
      });

      it("rejects calling disallowed tools", async () => {
        await Promise.all(
          invocations.map(async (invocation) => {
            const { name, params, _type } = invocation;
            if (_type === "success") {
              return;
            }

            await expect(
              testHarness.client.callTool({
                name,
                arguments: params,
              }),
            ).rejects.toThrow();
            return;
          }),
        );
      });
    });
  });
});
