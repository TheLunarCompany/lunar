import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type CreateCapabilityGroupPayload,
  type CreateCustomCapabilityToolPayload,
  type DeleteCustomCapabilityToolPayload,
  type UpdateCapabilityGroupPayload,
  type UpdateCustomCapabilityToolPayload,
  createCapabilityGroup,
  createCustomCapabilityTool,
  deleteCapabilityGroup,
  deleteCustomCapabilityTool,
  updateCapabilityGroup,
  updateCustomCapabilityTool,
} from "./capability-actions";
import { apiClient } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiClient: {
    createToolGroup: vi.fn(),
    updateToolGroup: vi.fn(),
    deleteToolGroup: vi.fn(),
    createToolExtension: vi.fn(),
    updateToolExtension: vi.fn(),
    deleteToolExtension: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe("capability actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates capability groups through the current tool group endpoint", async () => {
    const capabilityGroup = {
      name: "Filesystem Access",
      description: "Read files only",
      services: {
        filesystem: ["read_file"],
        github: "*",
      },
    } satisfies CreateCapabilityGroupPayload;
    mockedApiClient.createToolGroup.mockResolvedValue(capabilityGroup);

    const result = await createCapabilityGroup(capabilityGroup);

    expect(mockedApiClient.createToolGroup).toHaveBeenCalledWith({
      name: "Filesystem Access",
      description: "Read files only",
      services: {
        filesystem: ["read_file"],
        github: "*",
      },
    });
    expect(result).toBe(capabilityGroup);
  });

  it("updates capability groups through the current tool group endpoint", async () => {
    const updates = {
      name: "Repository Access",
      description: "Repository read and search",
      services: {
        github: ["list_repos", "search_code"],
      },
    } satisfies UpdateCapabilityGroupPayload;
    const updatedCapabilityGroup = {
      ...updates,
    };
    mockedApiClient.updateToolGroup.mockResolvedValue(updatedCapabilityGroup);

    const result = await updateCapabilityGroup("Filesystem Access", updates);

    expect(mockedApiClient.updateToolGroup).toHaveBeenCalledWith(
      "Filesystem Access",
      {
        name: "Repository Access",
        description: "Repository read and search",
        services: {
          github: ["list_repos", "search_code"],
        },
      },
    );
    expect(result).toBe(updatedCapabilityGroup);
  });

  it("deletes capability groups through the current tool group endpoint", async () => {
    mockedApiClient.deleteToolGroup.mockResolvedValue(undefined);

    await deleteCapabilityGroup("Filesystem Access");

    expect(mockedApiClient.deleteToolGroup).toHaveBeenCalledWith(
      "Filesystem Access",
    );
  });

  it("creates custom capability tools through the current tool extension endpoint", async () => {
    const customCapabilityTool = {
      name: "safe_read_file",
      description: { action: "rewrite", text: "Read approved files" },
      overrideParams: {
        path: { value: "/tmp/report.txt" },
      },
    } satisfies CreateCustomCapabilityToolPayload["customCapabilityTool"];
    mockedApiClient.createToolExtension.mockResolvedValue(customCapabilityTool);

    const result = await createCustomCapabilityTool({
      providerName: "filesystem",
      baseCapabilityName: "read_file",
      customCapabilityTool,
    });

    expect(mockedApiClient.createToolExtension).toHaveBeenCalledWith(
      "filesystem",
      "read_file",
      {
        name: "safe_read_file",
        description: { action: "rewrite", text: "Read approved files" },
        overrideParams: {
          path: { value: "/tmp/report.txt" },
        },
      },
    );
    expect(result).toBe(customCapabilityTool);
  });

  it("updates custom capability tools through the current tool extension endpoint", async () => {
    const updates = {
      description: { action: "rewrite", text: "Read approved files only" },
      overrideParams: {
        path: {
          description: {
            action: "rewrite",
            text: "Approved file path",
          },
        },
      },
    } satisfies UpdateCustomCapabilityToolPayload["updates"];
    const updatedCapabilityTool = {
      name: "safe_read_file",
      ...updates,
    };
    mockedApiClient.updateToolExtension.mockResolvedValue(
      updatedCapabilityTool,
    );

    const result = await updateCustomCapabilityTool({
      providerName: "filesystem",
      baseCapabilityName: "read_file",
      customCapabilityName: "safe_read_file",
      updates,
    });

    expect(mockedApiClient.updateToolExtension).toHaveBeenCalledWith(
      "filesystem",
      "read_file",
      "safe_read_file",
      {
        description: {
          action: "rewrite",
          text: "Read approved files only",
        },
        overrideParams: {
          path: {
            description: {
              action: "rewrite",
              text: "Approved file path",
            },
          },
        },
      },
    );
    expect(result).toBe(updatedCapabilityTool);
  });

  it("deletes custom capability tools through the current tool extension endpoint", async () => {
    mockedApiClient.deleteToolExtension.mockResolvedValue(undefined);

    const payload = {
      providerName: "filesystem",
      baseCapabilityName: "read_file",
      customCapabilityName: "safe_read_file",
    } satisfies DeleteCustomCapabilityToolPayload;

    await deleteCustomCapabilityTool(payload);

    expect(mockedApiClient.deleteToolExtension).toHaveBeenCalledWith(
      "filesystem",
      "read_file",
      "safe_read_file",
    );
  });

  it("propagates rejected API calls", async () => {
    const apiError = new Error("delete failed");
    mockedApiClient.deleteToolGroup.mockRejectedValue(apiError);

    await expect(deleteCapabilityGroup("Dangerous Access")).rejects.toThrow(
      "delete failed",
    );
  });
});
