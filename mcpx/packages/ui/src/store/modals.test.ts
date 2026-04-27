import { beforeEach, describe, expect, it } from "vitest";
import { modalsStore } from "./modals";

function resetModalsStore() {
  modalsStore.setState({
    editServerModalData: undefined,
    isAddServerModalOpen: false,
    isAgentDetailsModalOpen: false,
    isConfigModalOpen: false,
    isCustomToolModalOpen: false,
    isEditServerModalOpen: false,
    isMcpxDetailsModalOpen: false,
    isMcpxSaving: false,
    isServerDetailsModalOpen: false,
    isToolDetailsModalOpen: false,
    selectedAgent: undefined,
    selectedMcpxData: undefined,
    selectedServer: undefined,
    selectedTool: undefined,
    serverDetailsOpenedFromInsertValueButton: false,
    toolDetails: undefined,
  });
}

describe("modalsStore", () => {
  beforeEach(() => {
    resetModalsStore();
  });

  it("opens and closes the server management modals", () => {
    const targetServer = { name: "filesystem" } as never;

    modalsStore.getState().openAddServerModal();
    modalsStore.getState().openEditServerModal(targetServer);
    modalsStore.getState().openConfigModal();

    expect(modalsStore.getState()).toMatchObject({
      editServerModalData: targetServer,
      isAddServerModalOpen: true,
      isConfigModalOpen: true,
      isEditServerModalOpen: true,
    });

    modalsStore.getState().closeAddServerModal();
    modalsStore.getState().closeEditServerModal();
    modalsStore.getState().closeConfigModal();

    expect(modalsStore.getState()).toMatchObject({
      editServerModalData: undefined,
      isAddServerModalOpen: false,
      isConfigModalOpen: false,
      isEditServerModalOpen: false,
    });
  });

  it("tracks custom tool and tool details modal payloads", () => {
    const customTool = { name: "masked-fetch" } as never;
    const toolDetails = { name: "fetch" } as never;

    modalsStore.getState().openCustomToolModal(customTool);
    modalsStore.getState().openToolDetailsModal(toolDetails);

    expect(modalsStore.getState()).toMatchObject({
      isCustomToolModalOpen: true,
      isToolDetailsModalOpen: true,
      selectedTool: customTool,
      toolDetails,
    });

    modalsStore.getState().closeCustomToolModal();
    modalsStore.getState().closeToolDetailsModal();

    expect(modalsStore.getState()).toMatchObject({
      isCustomToolModalOpen: false,
      isToolDetailsModalOpen: false,
      selectedTool: null,
      toolDetails: null,
    });
  });

  it("tracks server, agent, mcpx, and saving state independently", () => {
    const server = { name: "slack" } as never;
    const agent = { name: "Claude" } as never;
    const mcpxData = { name: "runtime-1" } as never;

    modalsStore
      .getState()
      .openServerDetailsModal(server, { fromInsertValueButton: true });
    modalsStore.getState().openAgentDetailsModal(agent);
    modalsStore.getState().openMcpxDetailsModal(mcpxData);
    modalsStore.getState().setIsMcpxSaving(true);

    expect(modalsStore.getState()).toMatchObject({
      isAgentDetailsModalOpen: true,
      isMcpxDetailsModalOpen: true,
      isMcpxSaving: true,
      isServerDetailsModalOpen: true,
      selectedAgent: agent,
      selectedMcpxData: mcpxData,
      selectedServer: server,
      serverDetailsOpenedFromInsertValueButton: true,
    });

    modalsStore.getState().closeServerDetailsModal();
    modalsStore.getState().closeAgentDetailsModal();
    modalsStore.getState().closeMcpxDetailsModal();
    modalsStore.getState().setIsMcpxSaving(false);

    expect(modalsStore.getState()).toMatchObject({
      isAgentDetailsModalOpen: false,
      isMcpxDetailsModalOpen: false,
      isMcpxSaving: false,
      isServerDetailsModalOpen: false,
      selectedAgent: undefined,
      selectedMcpxData: undefined,
      selectedServer: null,
      serverDetailsOpenedFromInsertValueButton: false,
    });
  });
});
