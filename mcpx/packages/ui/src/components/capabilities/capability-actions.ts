import type {
  ToolExtension,
  ToolGroup,
  ToolGroupUpdate,
} from "@mcpx/shared-model";

import { apiClient } from "@/lib/api";

export type CreateCapabilityGroupPayload = ToolGroup;

export type UpdateCapabilityGroupPayload = ToolGroupUpdate;

export type CreateCustomCapabilityToolPayload = {
  providerName: string;
  baseCapabilityName: string;
  customCapabilityTool: ToolExtension;
};

export type UpdateCustomCapabilityToolPayload = {
  providerName: string;
  baseCapabilityName: string;
  customCapabilityName: string;
  updates: Omit<ToolExtension, "name">;
};

export type DeleteCustomCapabilityToolPayload = {
  providerName: string;
  baseCapabilityName: string;
  customCapabilityName: string;
};

export function createCapabilityGroup(
  capabilityGroup: CreateCapabilityGroupPayload,
): Promise<ToolGroup> {
  return apiClient.createToolGroup(capabilityGroup);
}

export function updateCapabilityGroup(
  capabilityGroupName: string,
  updates: UpdateCapabilityGroupPayload,
): Promise<ToolGroup> {
  return apiClient.updateToolGroup(capabilityGroupName, updates);
}

export function deleteCapabilityGroup(
  capabilityGroupName: string,
): Promise<void> {
  return apiClient.deleteToolGroup(capabilityGroupName);
}

export function createCustomCapabilityTool({
  providerName,
  baseCapabilityName,
  customCapabilityTool,
}: CreateCustomCapabilityToolPayload): Promise<ToolExtension> {
  return apiClient.createToolExtension(
    providerName,
    baseCapabilityName,
    customCapabilityTool,
  );
}

export function updateCustomCapabilityTool({
  providerName,
  baseCapabilityName,
  customCapabilityName,
  updates,
}: UpdateCustomCapabilityToolPayload): Promise<ToolExtension> {
  return apiClient.updateToolExtension(
    providerName,
    baseCapabilityName,
    customCapabilityName,
    updates,
  );
}

export function deleteCustomCapabilityTool({
  providerName,
  baseCapabilityName,
  customCapabilityName,
}: DeleteCustomCapabilityToolPayload): Promise<void> {
  return apiClient.deleteToolExtension(
    providerName,
    baseCapabilityName,
    customCapabilityName,
  );
}
