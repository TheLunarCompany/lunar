import type {
  ToolGroup,
  ToolExtension,
  ToolExtensions,
  ConsumerConfig,
  Permissions,
  CreatePermissionConsumerRequest,
  GetIdentityResponse,
  StrictnessResponse,
} from "@mcpx/shared-model";
import {
  singleToolGroupSchema,
  toolExtensionSchema,
  toolExtensionsSchema,
  consumerConfigSchema,
  permissionsSchema,
  getIdentityResponseSchema,
  strictnessResponseSchema,
} from "@mcpx/shared-model";
import z from "zod/v4";
import { getMcpxServerURL } from "@/config/api-config";
import { targetServerAttributesSchema } from "@mcpx/shared-model";

class ApiClient {
  private getBaseUrl: () => string;

  constructor(getBaseUrl: () => string) {
    this.getBaseUrl = getBaseUrl;
  }

  private get baseUrl(): string {
    return this.getBaseUrl() || getMcpxServerURL("http");
  }

  private async request<T>(endpoint: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const result = schema.safeParse(data);
    if (!result.success) {
      console.error(`Schema validation failed for ${endpoint}:`, {
        error: result.error,
        data,
      });
      throw result.error;
    }
    return result.data;
  }

  private async requestWithBody<T>(
    endpoint: string,
    method: "POST" | "PUT",
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const responseData = await response.json();
    const result = schema.safeParse(responseData);
    if (!result.success) {
      console.error(`Schema validation failed for ${method} ${endpoint}:`, {
        error: result.error,
        responseData,
        requestBody: body,
      });
      throw result.error;
    }
    return result.data;
  }

  // ==================== TOOL GROUPS ====================

  async getToolGroups(): Promise<ToolGroup[]> {
    return this.request("/config/tool-groups", z.array(singleToolGroupSchema));
  }

  async getToolGroup(name: string): Promise<ToolGroup> {
    return this.request(`/config/tool-groups/${name}`, singleToolGroupSchema);
  }

  async createToolGroup(toolGroup: ToolGroup): Promise<ToolGroup> {
    return this.requestWithBody(
      "/config/tool-groups",
      "POST",
      toolGroup,
      singleToolGroupSchema,
    );
  }

  async updateToolGroup(
    name: string,
    updates: Omit<ToolGroup, "name">,
  ): Promise<ToolGroup> {
    return this.requestWithBody(
      `/config/tool-groups/${name}`,
      "PUT",
      updates,
      singleToolGroupSchema,
    );
  }

  async deleteToolGroup(name: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/config/tool-groups/${name}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      // If group not found (404), that's okay - it's already deleted
      if (response.status === 404) {
        return;
      }
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  // ==================== TOOL EXTENSIONS ====================

  async getToolExtensions(): Promise<ToolExtensions> {
    return this.request("/config/tool-extensions", toolExtensionsSchema);
  }

  async getToolExtension(
    serverName: string,
    originalToolName: string,
    customToolName: string,
  ): Promise<ToolExtension> {
    return this.request(
      `/config/tool-extensions/${serverName}/${originalToolName}/${customToolName}`,
      toolExtensionSchema,
    );
  }

  async createToolExtension(
    serverName: string,
    originalToolName: string,
    extension: ToolExtension,
  ): Promise<ToolExtension> {
    return this.requestWithBody(
      `/config/tool-extensions/${serverName}/${originalToolName}`,
      "POST",
      extension,
      toolExtensionSchema,
    );
  }

  async updateToolExtension(
    serverName: string,
    originalToolName: string,
    customToolName: string,
    updates: Omit<ToolExtension, "name">,
  ): Promise<ToolExtension> {
    return this.requestWithBody(
      `/config/tool-extensions/${serverName}/${originalToolName}/${customToolName}`,
      "PUT",
      updates,
      toolExtensionSchema,
    );
  }

  async deleteToolExtension(
    serverName: string,
    originalToolName: string,
    customToolName: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/config/tool-extensions/${serverName}/${originalToolName}/${customToolName}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    if (!response.ok) {
      // If tool extension not found (404), that's okay - it's already deleted
      if (response.status === 404) {
        return;
      }
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  // ==================== PERMISSIONS ====================

  async getPermissions(): Promise<Permissions> {
    return this.request("/config/permissions", permissionsSchema);
  }

  async getDefaultPermission(): Promise<ConsumerConfig> {
    return this.request("/config/permissions/default", consumerConfigSchema);
  }

  async updateDefaultPermission(
    config: ConsumerConfig,
  ): Promise<ConsumerConfig> {
    return this.requestWithBody(
      "/config/permissions/default",
      "PUT",
      config,
      consumerConfigSchema,
    );
  }

  async getPermissionConsumers(): Promise<Record<string, ConsumerConfig>> {
    return this.request(
      "/config/permissions/consumers",
      z.record(z.string(), consumerConfigSchema),
    );
  }

  async getPermissionConsumer(consumerName: string): Promise<ConsumerConfig> {
    return this.request(
      `/config/permissions/consumers/${consumerName}`,
      consumerConfigSchema,
    );
  }

  async createPermissionConsumer(
    request: CreatePermissionConsumerRequest,
  ): Promise<ConsumerConfig> {
    return this.requestWithBody(
      "/config/permissions/consumers",
      "POST",
      request,
      consumerConfigSchema,
    );
  }

  async updatePermissionConsumer(
    consumerName: string,
    config: ConsumerConfig,
  ): Promise<ConsumerConfig> {
    return this.requestWithBody(
      `/config/permissions/consumers/${consumerName}`,
      "PUT",
      config,
      consumerConfigSchema,
    );
  }

  async deletePermissionConsumer(consumerName: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/config/permissions/consumers/${consumerName}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    if (!response.ok) {
      // If consumer not found (404), that's okay - it's already deleted
      if (response.status === 404) {
        return;
      }
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  // ==================== TARGET SERVER ATTRIBUTES ====================

  async getTargetServerAttributes(): Promise<
    Record<string, { inactive: boolean }>
  > {
    return this.request(
      "/config/target-servers/attributes",
      targetServerAttributesSchema,
    );
  }

  async activateTargetServer(name: string): Promise<{ message: string }> {
    return this.request(
      `/config/target-server/${name}/activate`,
      z.object({ message: z.string() }),
    );
  }

  async deactivateTargetServer(name: string): Promise<{ message: string }> {
    return this.request(
      `/config/target-server/${name}/deactivate`,
      z.object({ message: z.string() }),
    );
  }

  // ==================== IDENTITY & ADMIN ====================

  async getIdentity(): Promise<GetIdentityResponse> {
    return this.request("/identity", getIdentityResponseSchema);
  }

  async getStrictness(): Promise<StrictnessResponse> {
    return this.request("/admin/strictness", strictnessResponseSchema);
  }

  async setStrictnessOverride(override: boolean): Promise<StrictnessResponse> {
    return this.requestWithBody(
      "/admin/strictness",
      "POST",
      { override },
      strictnessResponseSchema,
    );
  }
}

// Initialize with getMcpxServerURL as fallback
export const apiClient = new ApiClient(() => getMcpxServerURL("http"));
