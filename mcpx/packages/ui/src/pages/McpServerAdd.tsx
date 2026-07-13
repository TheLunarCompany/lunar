import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { RawCreateTargetServerRequest } from "@mcpx/shared-model";
import type { EnvValue } from "@mcpx/shared-model";
import {
  type CatalogMCPServerConfigByNameItem,
  isRemoteUrlNeedEdit,
  validateAndProcessServer,
  validateServerCommand,
  validateServerName,
} from "@mcpx/toolkit-ui/src/utils/server-helpers";
import { convertRequirementsToValues } from "@mcpx/toolkit-ui/src/utils/env-vars-utils";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/use-toast";
import { Sort } from "@/components/Sort";
import { AddMcpServersSelectionBar } from "@/components/mcp-servers/AddMcpServersSelectionBar";
import { McpServerCatalogCard } from "@/components/mcp-servers/McpServerCatalogCard";
import { useGetMCPServers } from "@/data/catalog-servers";
import { useAddMcpServer } from "@/data/mcp-server";
import { routes } from "@/routes";
import { useSocketStore } from "@/store";

const catalogGridStyle = {
  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
};

const SKELETON_PLACEHOLDERS = Array.from({ length: 6 }, (_, index) => index);

type SortOrder = "asc" | "desc";

const SORT_OPTIONS: Array<{ label: string; value: SortOrder }> = [
  { label: "A to Z", value: "asc" },
  { label: "Z to A", value: "desc" },
];

function getAddableCatalogServerConfig(
  server: CatalogMCPServerConfigByNameItem,
): Record<string, unknown> {
  const currentTargetServerData = server.config[server.name];
  if (!currentTargetServerData) {
    return server.config;
  }

  if (currentTargetServerData.type === "stdio") {
    const finalEnv: Record<string, EnvValue> = convertRequirementsToValues(
      currentTargetServerData.env ?? {},
    );

    return {
      [server.name]: {
        ...currentTargetServerData,
        env: finalEnv,
      },
    };
  }

  const updatedTargetServerData = isRemoteUrlNeedEdit(currentTargetServerData)
    ? {
        ...currentTargetServerData,
        url:
          currentTargetServerData.type === "streamable-http"
            ? "https://edit-this-url.com/mcp"
            : "https://www.edit-this-url.com/sse",
      }
    : currentTargetServerData;

  return { [server.name]: updatedTargetServerData };
}

function buildCatalogServerPayload({
  server,
  existingServers,
}: {
  server: CatalogMCPServerConfigByNameItem;
  existingServers: Array<{ name: string }>;
}): RawCreateTargetServerRequest {
  const config = getAddableCatalogServerConfig(server);
  const jsonContent = JSON.stringify(config, null, 2);
  const actualServerName = Object.keys(config)[0] ?? server.name;

  const result = validateAndProcessServer({
    jsonContent,
    existingServers,
    isEdit: false,
  });

  if (result.success === false || !result.payload) {
    throw new Error(result.error || "Failed to add server. Please try again.");
  }

  const nameError = validateServerName(actualServerName);
  if (nameError) {
    throw new Error(nameError);
  }

  const commandError = validateServerCommand(result.payload);
  if (commandError) {
    throw new Error(commandError);
  }

  return {
    ...result.payload,
    catalogItemId: server.id,
  };
}

export default function McpServerAdd() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const targetServers = useSocketStore(
    (state) => state.systemState?.targetServers ?? [],
  );
  const { data: catalogServersData, isLoading, error } = useGetMCPServers();
  const { mutateAsync: addServerAsync } = useAddMcpServer();
  const catalogServers = useMemo(
    () => catalogServersData ?? [],
    [catalogServersData],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isAdding, setIsAdding] = useState(false);

  const addedItemIds = useMemo(
    () =>
      new Set(
        targetServers
          .map((server) => server.catalogItemId)
          .filter((id): id is string => Boolean(id)),
      ),
    [targetServers],
  );
  const addedServerNames = useMemo(
    () => new Set(targetServers.map((server) => server.name.toLowerCase())),
    [targetServers],
  );

  const filteredCatalogServers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return [...catalogServers]
      .filter((server) => {
        if (!normalizedSearch) return true;

        return (
          server.name.toLowerCase().includes(normalizedSearch) ||
          server.displayName.toLowerCase().includes(normalizedSearch) ||
          (server.description ?? "").toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => {
        const comparison = (a.displayName || a.name).localeCompare(
          b.displayName || b.name,
        );
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [catalogServers, searchQuery, sortOrder]);

  const visibleSelectableServers = filteredCatalogServers.filter(
    (server) =>
      !addedItemIds.has(server.id) &&
      !addedServerNames.has(server.name.toLowerCase()),
  );
  const selectedVisibleServers = visibleSelectableServers.filter((server) =>
    selectedIds.has(server.id),
  );
  const canSelectVisible =
    visibleSelectableServers.length > selectedVisibleServers.length;
  const canClearVisible = selectedVisibleServers.length > 0;

  const handleCheckedChange = (itemId: string, checked: boolean): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const handleSelectVisible = (): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleSelectableServers.forEach((server) => next.add(server.id));
      return next;
    });
  };

  const handleClearVisible = (): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      selectedVisibleServers.forEach((server) => next.delete(server.id));
      return next;
    });
  };

  const handleAddSelected = async (): Promise<void> => {
    const selectedServers = catalogServers.filter((server) =>
      selectedIds.has(server.id),
    );
    if (selectedServers.length === 0) return;

    setIsAdding(true);
    const addedIds: string[] = [];
    const failedServers: Array<{ name: string; error: string }> = [];
    const existingServers = targetServers.map((server) => ({
      name: server.name,
    }));

    // Add sequentially so each successful server joins `existingServers`
    // before validating the next selected catalog item.
    for (const server of selectedServers) {
      try {
        const payload = buildCatalogServerPayload({
          server,
          existingServers,
        });
        const addedServer = await addServerAsync({ payload });
        addedIds.push(server.id);
        existingServers.push({ name: addedServer.name });
      } catch (serverError) {
        failedServers.push({
          name: server.displayName || server.name,
          error:
            serverError instanceof Error
              ? serverError.message
              : "Failed to add server",
        });
      }
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      addedIds.forEach((id) => next.delete(id));
      return next;
    });
    setIsAdding(false);

    if (failedServers.length === 0) {
      toast({
        title: "Servers Added",
        description: `Added ${addedIds.length} server${
          addedIds.length === 1 ? "" : "s"
        } successfully.`,
        variant: "server-info",
        position: "bottom-left",
      });
      navigate(routes.mcpServers);
      return;
    }

    if (addedIds.length > 0) {
      toast({
        title: "Some Servers Added",
        description: `Added ${addedIds.length}; failed to add ${failedServers.length}.`,
        variant: "warning",
        position: "bottom-left",
      });
      return;
    }

    toast({
      title: "Failed to Add Servers",
      description: failedServers[0]?.error ?? "Please try again.",
      variant: "destructive",
      position: "bottom-left",
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background p-6 pb-28">
      <Link
        to={routes.mcpServers}
        className="mb-5 inline-flex w-fit items-center gap-2 text-[#20222A] transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="size-5" />
        <h1 className="text-[20px] font-semibold">Add Server</h1>
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Search servers"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          wrapperClassName="w-[320px] max-w-full"
          className="rounded-lg"
        />
        <Sort
          title="Sort"
          options={SORT_OPTIONS}
          selected={sortOrder}
          onChange={setSortOrder}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectVisible}
            disabled={!canSelectVisible}
          >
            Select visible
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearVisible}
            disabled={!canClearVisible}
          >
            Clear visible
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4" style={catalogGridStyle}>
          {SKELETON_PLACEHOLDERS.map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-lg border border-gray-100 bg-white p-4"
            >
              <div className="mb-4 h-10 w-40 rounded bg-gray-200" />
              <div className="h-4 w-full rounded bg-gray-200" />
              <div className="mt-2 h-4 w-2/3 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">
          Failed to load catalog: {error.message}
        </p>
      ) : (
        <>
          <div className="grid gap-4" style={catalogGridStyle}>
            {filteredCatalogServers.map((server) => {
              const isAdded =
                addedItemIds.has(server.id) ||
                addedServerNames.has(server.name.toLowerCase());

              return (
                <McpServerCatalogCard
                  key={server.id}
                  server={server}
                  checked={isAdded ? true : selectedIds.has(server.id)}
                  onCheckedChange={
                    isAdded
                      ? (): void => {}
                      : (checked) => handleCheckedChange(server.id, checked)
                  }
                  className={isAdded ? "cursor-default" : ""}
                  checkboxDisabled={isAdded}
                />
              );
            })}
          </div>

          {filteredCatalogServers.length === 0 && (
            <p className="mt-6 text-sm text-gray-500">
              {catalogServers.length === 0
                ? "No servers in the catalog."
                : "No servers match your search."}
            </p>
          )}
        </>
      )}

      <AddMcpServersSelectionBar
        selectedCount={selectedIds.size}
        onAdd={() => void handleAddSelected()}
        isAdding={isAdding}
      />
    </div>
  );
}
