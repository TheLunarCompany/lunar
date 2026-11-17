import { beforeEach, describe, expect, it } from "vitest";
import { socketStore } from "./socket";
import { toolsStore, type CustomTool } from "./tools";

function resetSocketStore() {
  socketStore.setState({
    appConfig: null,
    serializedAppConfig: null,
    systemState: null,
  });
}

function resetToolsStore() {
  toolsStore.setState({
    customTools: [],
    tools: [],
  });
}

describe("toolsStore", () => {
  beforeEach(() => {
    resetSocketStore();
    resetToolsStore();
  });

  it("initializes tools and custom tools from socket state", () => {
    toolsStore.getState().init({
      appConfig: {
        permissions: {
          consumers: {},
          default: { _type: "default-allow", block: [] },
        },
        toolExtensions: {
          services: {
            filesystem: {
              read_file: {
                childTools: [
                  {
                    description: { action: "rewrite", text: "masked" },
                    name: "masked-read",
                    overrideParams: {
                      path: {
                        description: { action: "rewrite", text: "masked path" },
                      },
                      unused: {
                        description: { action: "rewrite", text: "   " },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      } as never,
      systemState: {
        targetServers: [
          {
            name: "filesystem",
            originalTools: [
              {
                description: "Read files",
                inputSchema: {
                  properties: {
                    path: { type: "string" },
                  },
                },
                name: "read_file",
              },
            ],
          },
        ],
      } as never,
    } as never);

    expect(toolsStore.getState().tools).toEqual([
      {
        description: "Read files",
        id: "filesystem__read_file",
        inputSchema: {
          properties: {
            path: { type: "string" },
          },
        },
        name: "read_file",
        serviceName: "filesystem",
      },
    ]);

    expect(toolsStore.getState().customTools).toEqual([
      expect.objectContaining({
        description: { action: "rewrite", text: "masked" },
        id: "filesystem__masked-read",
        name: "masked-read",
        originalTool: expect.objectContaining({
          id: "filesystem__read_file",
          name: "read_file",
          serviceName: "filesystem",
        }),
        parameterDescriptions: {
          path: "masked path",
        },
      }),
    ]);
  });

  it("supports direct and functional tool updates", () => {
    toolsStore.getState().setTools([
      {
        id: "filesystem__read_file",
        name: "read_file",
        serviceName: "filesystem",
      },
    ]);

    toolsStore
      .getState()
      .setTools((tools) => [
        ...tools,
        { id: "slack__post", name: "post", serviceName: "slack" },
      ]);

    expect(toolsStore.getState().tools).toEqual([
      {
        id: "filesystem__read_file",
        name: "read_file",
        serviceName: "filesystem",
      },
      {
        id: "slack__post",
        name: "post",
        serviceName: "slack",
      },
    ]);
  });

  it("creates, updates, and deletes custom tool config from the current app config", async () => {
    socketStore.setState({
      appConfig: {
        permissions: {
          consumers: {},
          default: { _type: "default-allow", block: [] },
        },
        toolExtensions: {
          services: {
            filesystem: {
              read_file: {
                childTools: [
                  {
                    description: { action: "append", text: "legacy" },
                    name: "legacy-tool",
                    overrideParams: {},
                  },
                  {
                    description: { action: "rewrite", text: "old copy" },
                    name: "masked-read",
                    overrideParams: {
                      path: {
                        description: { action: "rewrite", text: "old path" },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      } as never,
    });

    const customTool: CustomTool = {
      description: { action: "rewrite", text: "new copy" },
      name: "masked-read",
      originalName: "masked-read",
      originalTool: {
        id: "filesystem__read_file",
        name: "read_file",
        serviceName: "filesystem",
      },
      overrideParams: {
        path: {
          description: { action: "rewrite", text: "masked path" },
        },
      },
    };

    const createdConfig = await toolsStore.getState().createCustomTool({
      ...customTool,
      name: "masked-read-v2",
      originalName: undefined,
    });
    expect(
      createdConfig.toolExtensions?.services.filesystem.read_file.childTools,
    ).toContainEqual({
      description: { action: "rewrite", text: "new copy" },
      name: "masked-read-v2",
      overrideParams: {
        path: {
          description: { action: "rewrite", text: "masked path" },
        },
      },
    });

    const updatedConfig = toolsStore.getState().updateCustomTool({
      ...customTool,
      name: "masked-read-renamed",
      originalName: "masked-read",
    });
    expect(
      updatedConfig.toolExtensions?.services.filesystem.read_file.childTools,
    ).toContainEqual({
      description: { action: "rewrite", text: "new copy" },
      name: "masked-read-renamed",
      overrideParams: {
        path: {
          description: { action: "rewrite", text: "masked path" },
        },
      },
    });
    expect(
      updatedConfig.toolExtensions?.services.filesystem.read_file.childTools,
    ).not.toContainEqual(
      expect.objectContaining({
        name: "masked-read",
      }),
    );

    toolsStore.setState({
      customTools: [
        {
          ...customTool,
          name: "masked-read",
        },
      ],
    });

    const deletedConfig = await toolsStore.getState().deleteCustomTool({
      ...customTool,
      name: "masked-read",
    });
    expect(deletedConfig.toolExtensions?.services).toEqual({});
  });
});
