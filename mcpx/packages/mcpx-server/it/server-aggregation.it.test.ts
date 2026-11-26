import { getTestHarness, transportTypes } from "./utils.js";

describe.each(transportTypes)("%s Router", (transportType) => {
  const testHarness = getTestHarness();
  const client = testHarness.client;

  beforeAll(async () => {
    await testHarness.initialize(transportType);
  });

  afterAll(async () => {
    await testHarness.shutdown();
  });

  it("responds to listTools requests from end-client by listing target MCP server", async () => {
    const res = await client.listTools();
    expect(res.tools).toMatchSnapshot();
  });

  it("passes callTool requests from end-client to target MCP servers", async () => {
    const resEcho = await client.callTool({
      name: "echo-service__echo",
      arguments: { message: "The sound of silence?" },
    });
    expect(resEcho).toMatchSnapshot();

    const resAddition = await client.callTool({
      name: "calculator-service__add",
      arguments: { a: 5, b: 2 },
    });
    expect(resAddition).toMatchSnapshot();

    const resPowerOfTwo = await client.callTool({
      name: "calculator-service__powerOfTwo",
      arguments: { base: 4 },
    });
    expect(resPowerOfTwo).toMatchSnapshot();
  });
});
