import type {
  ToolGroup,
  ToolGroupUpdate,
  ToolExtension,
  ToolExtensions,
  ConsumerConfig,
  Permissions,
  CreatePermissionConsumerRequest,
  ListSavedSetupsResponse,
  SaveSetupResponse,
  MessageResponse,
  GetIdentityResponse,
  StrictnessResponse,
  DynamicCapabilitiesStatusResponse,
  TargetServer,
  CreateServerFromCatalogRequest,
  CatalogMCPServerItem,
  UpdateTargetServerRequest,
  RawCreateTargetServerRequest,
  RawUpdateTargetServerRequest,
  ApplyParsedAppConfigRequest,
  SerializedAppConfig,
  AuditLogEntry,
  AuditLogEventType,
  Skill,
  SkillCapabilityGroup,
  SkillDraft,
} from "@mcpx/shared-model";
import {
  singleToolGroupSchema,
  toolExtensionSchema,
  toolExtensionsSchema,
  consumerConfigSchema,
  permissionsSchema,
  listSavedSetupsResponseSchema,
  saveSetupResponseSchema,
  messageResponseSchema,
  getIdentityResponseSchema,
  strictnessResponseSchema,
  dynamicCapabilitiesStatusResponseSchema,
  catalogMCPServerListSchema,
  auditLogsResponseSchema,
  skillCatalogResponseSchema,
  skillSchema,
} from "@mcpx/shared-model";
import z from "zod/v4";
import { getAdminWebserverURL, getMcpxServerURL } from "@/config/api-config";
import {
  targetServerAttributesSchema,
  secretKeysSchema,
  type SecretKeys,
} from "@mcpx/shared-model";
import {
  CatalogMCPServerConfigByNameItem,
  CatalogMCPServerConfigByNameList,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";

type SkillDetailsDraft = Omit<SkillDraft, "capabilityGroup">;

export class ApiError extends Error {
  status: number;
  responseData: unknown;

  constructor(message: string, status: number, responseData: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.responseData = responseData;
  }
}

const apiErrorResponseSchema = z.object({
  message: z.string(),
});

const apiSkillSchema = skillSchema.extend({
  body: z.string().trim(),
});

const apiSkillCatalogResponseSchema = skillCatalogResponseSchema.extend({
  skills: z.array(apiSkillSchema),
});

async function getApiError(response: Response): Promise<ApiError> {
  let responseData: unknown;
  let message = `API request failed: ${response.status} ${response.statusText}`;

  try {
    responseData = await response.json();
    const parsedResponseData = apiErrorResponseSchema.safeParse(responseData);
    if (parsedResponseData.success) {
      message = parsedResponseData.data.message;
    }
  } catch {
    responseData = undefined;
  }

  return new ApiError(message, response.status, responseData);
}

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
      throw await getApiError(response);
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
    method: "POST" | "PUT" | "PATCH",
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
      throw await getApiError(response);
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

  // ==================== CATALOG SERVERS ====================

  async getCatalogServers(): Promise<CatalogMCPServerConfigByNameList> {
    const catalogServers = await this.request(
      "/catalog/mcp-servers",
      catalogMCPServerListSchema,
    );
    return catalogServers.map(addNameToCatalogMcpServerConfig);
  }

  async addCatalogServer(
    id: string,
    env: CreateServerFromCatalogRequest,
  ): Promise<TargetServer> {
    return this.requestWithBody(
      `/catalog-item/${id}/target-server`,
      "POST",
      env,
      z.custom<TargetServer>(), // TODO: replace with validation RND-404
    );
  }

  async updateCatalogServer(
    id: string,
    config: UpdateTargetServerRequest,
  ): Promise<TargetServer> {
    return this.requestWithBody(
      `/catalog-item/${id}/target-server`,
      "PATCH",
      config,
      z.custom<TargetServer>(), // TODO: replace with validation RND-404
    );
  }

  // ==================== CUSTOM (non-catalog) TARGET SERVERS ====================

  async addTargetServer(
    payload: RawCreateTargetServerRequest,
  ): Promise<TargetServer> {
    return this.requestWithBody(
      "/target-server",
      "POST",
      payload,
      z.custom<TargetServer>(), // TODO: replace with validation RND-404
    );
  }

  async updateTargetServer(
    name: string,
    payload: RawUpdateTargetServerRequest,
  ): Promise<TargetServer> {
    return this.requestWithBody(
      `/target-server/${encodeURIComponent(name)}`,
      "PATCH",
      payload,
      z.custom<TargetServer>(), // TODO: replace with validation RND-404
    );
  }

  async deleteTargetServer(name: string): Promise<MessageResponse> {
    const response = await fetch(
      `${this.baseUrl}/target-server/${encodeURIComponent(name)}`,
      { method: "DELETE", credentials: "include" },
    );

    if (!response.ok) {
      // 404 on delete is fine — server already gone.
      if (response.status === 404) {
        return { message: `Target server ${name} removed successfully` };
      }
      throw await getApiError(response);
    }

    const data = await response.json();
    const result = messageResponseSchema.safeParse(data);
    if (!result.success) {
      console.error(`Schema validation failed for DELETE /target-server:`, {
        error: result.error,
        data,
      });
      throw result.error;
    }
    return result.data;
  }

  // ==================== APP CONFIG ====================

  async patchAppConfig(
    config: ApplyParsedAppConfigRequest,
  ): Promise<SerializedAppConfig> {
    return this.requestWithBody(
      "/app-config",
      "PATCH",
      config,
      z.custom<SerializedAppConfig>(), // TODO: replace with validation RND-404
    );
  }

  // ==================== TOOL GROUPS ====================

  async getToolGroups(): Promise<ToolGroup[]> {
    return this.request("/config/tool-groups", z.array(singleToolGroupSchema));
  }

  async getToolGroup(name: string): Promise<ToolGroup> {
    return this.request(
      `/config/tool-groups/${encodeURIComponent(name)}`,
      singleToolGroupSchema,
    );
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
    updates: ToolGroupUpdate,
  ): Promise<ToolGroup> {
    return this.requestWithBody(
      `/config/tool-groups/${encodeURIComponent(name)}`,
      "PUT",
      updates,
      singleToolGroupSchema,
    );
  }

  async deleteToolGroup(name: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/config/tool-groups/${encodeURIComponent(name)}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

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
      `/config/tool-extensions/${encodeURIComponent(serverName)}/${encodeURIComponent(originalToolName)}/${encodeURIComponent(customToolName)}`,
      toolExtensionSchema,
    );
  }

  async createToolExtension(
    serverName: string,
    originalToolName: string,
    extension: ToolExtension,
  ): Promise<ToolExtension> {
    return this.requestWithBody(
      `/config/tool-extensions/${encodeURIComponent(serverName)}/${encodeURIComponent(originalToolName)}`,
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
      `/config/tool-extensions/${encodeURIComponent(serverName)}/${encodeURIComponent(originalToolName)}/${encodeURIComponent(customToolName)}`,
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
      `${this.baseUrl}/config/tool-extensions/${encodeURIComponent(serverName)}/${encodeURIComponent(originalToolName)}/${encodeURIComponent(customToolName)}`,
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
    return this.getPermissionEntries("consumers");
  }

  async getPermissionConsumer(consumerName: string): Promise<ConsumerConfig> {
    return this.getPermissionEntry("consumers", consumerName);
  }

  async createPermissionConsumer(
    request: CreatePermissionConsumerRequest,
  ): Promise<ConsumerConfig> {
    return this.createPermissionEntry("consumers", request);
  }

  async updatePermissionConsumer(
    consumerName: string,
    config: ConsumerConfig,
  ): Promise<ConsumerConfig> {
    return this.updatePermissionEntry("consumers", consumerName, config);
  }

  async deletePermissionConsumer(consumerName: string): Promise<void> {
    return this.deletePermissionEntry("consumers", consumerName);
  }

  async getPermissionClientNames(): Promise<Record<string, ConsumerConfig>> {
    return this.getPermissionEntries("clientNames");
  }

  async getPermissionClientName(name: string): Promise<ConsumerConfig> {
    return this.getPermissionEntry("clientNames", name);
  }

  async createPermissionClientName(
    request: CreatePermissionConsumerRequest,
  ): Promise<ConsumerConfig> {
    return this.createPermissionEntry("clientNames", request);
  }

  async updatePermissionClientName(
    name: string,
    config: ConsumerConfig,
  ): Promise<ConsumerConfig> {
    return this.updatePermissionEntry("clientNames", name, config);
  }

  async deletePermissionClientName(name: string): Promise<void> {
    return this.deletePermissionEntry("clientNames", name);
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
    return this.requestWithBody(
      `/config/target-server/${encodeURIComponent(name)}/activate`,
      "PUT",
      {},
      z.object({ message: z.string() }),
    );
  }

  async deactivateTargetServer(name: string): Promise<{ message: string }> {
    return this.requestWithBody(
      `/config/target-server/${encodeURIComponent(name)}/deactivate`,
      "PUT",
      {},
      z.object({ message: z.string() }),
    );
  }

  // ==================== SAVED SETUPS ====================

  async getSavedSetups(): Promise<ListSavedSetupsResponse> {
    return this.request("/saved-setups", listSavedSetupsResponseSchema);
  }

  async saveSetup(props: { description: string }): Promise<SaveSetupResponse> {
    const { description } = props;
    return this.requestWithBody(
      "/saved-setups",
      "POST",
      { description },
      saveSetupResponseSchema,
    );
  }

  async deleteSavedSetup(props: { id: string }): Promise<MessageResponse> {
    const { id } = props;
    const response = await fetch(`${this.baseUrl}/saved-setups/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const result = messageResponseSchema.safeParse(data);
    if (!result.success) {
      console.error(
        `Schema validation failed for DELETE /saved-setups/${id}:`,
        { error: result.error, data },
      );
      throw result.error;
    }
    return result.data;
  }

  async restoreSavedSetup(props: { id: string }): Promise<MessageResponse> {
    const { id } = props;
    return this.requestWithBody(
      `/saved-setups/${id}/restore`,
      "POST",
      {},
      messageResponseSchema,
    );
  }

  async overwriteSavedSetup(props: { id: string }): Promise<MessageResponse> {
    const { id } = props;
    return this.requestWithBody(
      `/saved-setups/${id}`,
      "PUT",
      {},
      messageResponseSchema,
    );
  }

  async resetSetup(): Promise<MessageResponse> {
    return this.requestWithBody(
      "/setup/reset",
      "POST",
      {},
      messageResponseSchema,
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

  // ==================== SECRETS ====================

  async getSecrets(): Promise<SecretKeys> {
    return this.request("/catalog/secrets", secretKeysSchema);
  }

  // ==================== DYNAMIC CAPABILITIES ====================

  async getDynamicCapabilitiesStatus(
    consumerTag: string,
  ): Promise<DynamicCapabilitiesStatusResponse> {
    return this.request(
      `/dynamic-capabilities/${encodeURIComponent(consumerTag)}`,
      dynamicCapabilitiesStatusResponseSchema,
    );
  }

  async enableDynamicCapabilities(
    consumerTag: string,
  ): Promise<DynamicCapabilitiesStatusResponse> {
    return this.requestWithBody(
      `/dynamic-capabilities/${encodeURIComponent(consumerTag)}/enable`,
      "PUT",
      {},
      dynamicCapabilitiesStatusResponseSchema,
    );
  }

  async disableDynamicCapabilities(
    consumerTag: string,
  ): Promise<DynamicCapabilitiesStatusResponse> {
    return this.requestWithBody(
      `/dynamic-capabilities/${encodeURIComponent(consumerTag)}/disable`,
      "PUT",
      {},
      dynamicCapabilitiesStatusResponseSchema,
    );
  }

  // Private polymorphic core for permission entries — `consumers` and `clientNames`
  // share an identical CRUD contract on the server.

  private getPermissionEntries(
    scope: PermissionScope,
  ): Promise<Record<string, ConsumerConfig>> {
    return this.request(
      `/config/permissions/${scope}`,
      z.record(z.string(), consumerConfigSchema),
    );
  }

  private getPermissionEntry(
    scope: PermissionScope,
    name: string,
  ): Promise<ConsumerConfig> {
    return this.request(
      `/config/permissions/${scope}/${encodeURIComponent(name)}`,
      consumerConfigSchema,
    );
  }

  private createPermissionEntry(
    scope: PermissionScope,
    request: CreatePermissionConsumerRequest,
  ): Promise<ConsumerConfig> {
    return this.requestWithBody(
      `/config/permissions/${scope}`,
      "POST",
      request,
      consumerConfigSchema,
    );
  }

  private updatePermissionEntry(
    scope: PermissionScope,
    name: string,
    config: ConsumerConfig,
  ): Promise<ConsumerConfig> {
    return this.requestWithBody(
      `/config/permissions/${scope}/${encodeURIComponent(name)}`,
      "PUT",
      config,
      consumerConfigSchema,
    );
  }

  private async deletePermissionEntry(
    scope: PermissionScope,
    name: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/config/permissions/${scope}/${encodeURIComponent(name)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!response.ok) {
      // 404 on delete is fine — entry already gone.
      if (response.status === 404) return;
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  async getAuditLogs(filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    const params = new URLSearchParams();
    if (filter.eventTypes) {
      for (const t of filter.eventTypes) params.append("eventType", t);
    }
    if (filter.limit !== undefined)
      params.append("limit", String(filter.limit));
    const qs = params.toString();
    const { events } = await this.request(
      `/audit-logs${qs ? `?${qs}` : ""}`,
      auditLogsResponseSchema,
    );
    return events;
  }

  // ==================== SKILLS ====================

  async getSkills(): Promise<Skill[]> {
    const { skills } = await this.request(
      "/skills",
      apiSkillCatalogResponseSchema,
    );
    return skills;
  }

  async getSkill(id: string): Promise<Skill> {
    return this.request(`/skills/${encodeURIComponent(id)}`, apiSkillSchema);
  }

  async createSkill(draft: SkillDraft): Promise<Skill> {
    return this.requestWithBody("/skills", "POST", draft, apiSkillSchema);
  }

  async updateSkillDetails(
    id: string,
    draft: SkillDetailsDraft,
  ): Promise<Skill> {
    return this.requestWithBody(
      `/skills/${encodeURIComponent(id)}/details`,
      "PUT",
      draft,
      apiSkillSchema,
    );
  }

  async updateSkillCapabilities(
    id: string,
    capabilityGroup: SkillCapabilityGroup | null | undefined,
  ): Promise<Skill> {
    return this.requestWithBody(
      `/skills/${encodeURIComponent(id)}/capabilities`,
      "PUT",
      capabilityGroup === undefined ? {} : { capabilityGroup },
      apiSkillSchema,
    );
  }

  async deleteSkill(id: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/skills/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw await getApiError(response);
    }
  }
}

export type { AuditLogEntry, AuditLogEventType };

export interface AuditLogFilter {
  eventTypes?: AuditLogEventType[];
  limit?: number;
}

type PermissionScope = "consumers" | "clientNames";

// Initialize with getMcpxServerURL as fallback
export const apiClient = new ApiClient(() => getMcpxServerURL("http"));

// Ends the OBO edit on this space. Targets the admin webserver (not mcpx-server)
// and rides the admin's session cookie. Throws if the webserver URL is unset.
export async function finishObo(): Promise<void> {
  const baseUrl = getAdminWebserverURL();
  if (!baseUrl) {
    throw new Error("Admin webserver URL is not configured");
  }
  const response = await fetch(`${baseUrl}/obo`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw await getApiError(response);
  }
}

// Helper transform function:
function addNameToCatalogMcpServerConfig(
  item: CatalogMCPServerItem,
): CatalogMCPServerConfigByNameItem {
  const { name, config, ...rest } = item;
  const namedConfig = { [name]: config };
  return {
    ...rest,
    name: name,
    config: namedConfig,
  };
}
