"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ToolsItem } from "@/types";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleX,
  MoreHorizontal,
  Plus,
  Wrench,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Label } from "../ui/label";
import { ToolSelector } from "./ToolSelector";

export const columns: ColumnDef<ToolsItem>[] = [
  {
    accessorKey: "serviceName",
    header: ({ column }) => (
      <Button
        variant="link"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-3"
      >
        Server
        {column.getIsSorted() &&
          (column.getIsSorted() === "asc" ? <ArrowUp /> : <ArrowDown />)}
      </Button>
    ),
    cell: ({ row }) => <div>{row.getValue("serviceName")}</div>,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="link"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-3"
      >
        Name
        {column.getIsSorted() &&
          (column.getIsSorted() === "asc" ? <ArrowUp /> : <ArrowDown />)}
      </Button>
    ),
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "originalToolName",
    header: ({ column }) => (
      <Button
        variant="link"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="px-3"
      >
        Original Tool
        {column.getIsSorted() &&
          (column.getIsSorted() === "asc" ? <ArrowUp /> : <ArrowDown />)}
      </Button>
    ),
    cell: ({ row }) => {
      const originalToolName =
        (row.getValue("originalToolName") as string) || "";
      return (
        <span
          className={cn({
            "p-1.5 bg-[var(--color-bg-neutral)] text-[var(--color-fg-interactive)] rounded":
              Boolean(originalToolName),
          })}
        >
          {originalToolName}
        </span>
      );
    },
  },
];

export function ToolsTable({
  data,
  handleAddServerClick,
  handleCreateClick,
  handleDeleteTool,
  handleDetailsClick,
  handleDuplicateClick,
  handleEditClick,
}: {
  data: ToolsItem[];
  handleAddServerClick: () => void;
  handleCreateClick: (tool: ToolsItem) => void;
  handleDeleteTool: (tool: ToolsItem) => void;
  handleDetailsClick: (tool: ToolsItem) => void;
  handleDuplicateClick: (tool: ToolsItem) => void;
  handleEditClick: (tool: ToolsItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [showOnlyCustomTools, setShowOnlyCustomTools] = useState(false);

  const toggleCustomTools = () => setShowOnlyCustomTools((prev) => !prev);

  const originalTools = useMemo(
    () => data.filter((tool) => !tool.originalToolId),
    [data],
  );

  const filteredData = useMemo(() => {
    return showOnlyCustomTools
      ? data.filter((tool) => tool.originalToolId)
      : data;
  }, [data, showOnlyCustomTools]);

  const table = useReactTable({
    columns,
    data: filteredData,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [
        {
          id: "name",
          desc: false,
        },
      ],
    },
  });

  const { pageSize, pageIndex } = table.getState().pagination;

  const clearSearch = () => {
    table.resetGlobalFilter();
    inputRef.current?.focus();
  };

  const clearFilters = () => {
    setShowOnlyCustomTools(false);
    table.resetGlobalFilter();
    inputRef.current?.focus();
  };

  if (!data.length) {
    return (
      <div className="flex flex-col gap-1 items-center justify-center h-64 bg-[var(--color-bg-container-overlay)] rounded-lg p-6">
        <p>You have no MCP servers connected.</p>
        <p>Connect a server to see all your tools.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleAddServerClick();
          }}
          className="mt-4 px-2 border-[var(--color-border-interactive)] text-[var(--color-fg-interactive)] hover:bg-[var(--color-bg-interactive-hover)] hover:text-[var(--color-fg-interactive-hover)] focus:text-[var(--color-fg-interactive-hover)] focus:bg-[var(--color-bg-interactive-hover)]"
        >
          <Plus className="w-2 h-2 mr-0.5" />
          Add Server
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-[var(--color-bg-container)] rounded-xl border border-[var(--color-border-primary)] shadow-xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 mb-4 max-w-md grow">
          <div className="flex items-center">
            <Input
              className="max-w-40"
              placeholder="Filter tools..."
              value={table.getState().globalFilter || ""}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
              ref={inputRef}
            />
            <Tooltip open={inputRef.current?.value ? undefined : false}>
              <TooltipTrigger asChild>
                <Button
                  onClick={clearSearch}
                  variant="vanilla"
                  className="background-transparent focus-visible:ring-0 h-7 w-4 rounded-none"
                  disabled={!inputRef.current?.value}
                >
                  <CircleX />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                align="center"
                className="shadow bg-[var(--color-bg-container)] text-[var(--color-text-primary)] text-xs"
              >
                Clear search
              </TooltipContent>
            </Tooltip>
          </div>
          <Label className="flex items-center justify-between capitalize cursor-pointer">
            <Switch
              className="ml-2"
              checked={showOnlyCustomTools}
              onCheckedChange={toggleCustomTools}
            />
            <span className="ml-2 text-sm">Show only custom tools</span>
          </Label>
        </div>
        <ToolSelector
          toolsList={originalTools.map(({ name, serviceName }) => ({
            name,
            serviceName,
          }))}
          onSelectionChange={(value) =>
            handleCreateClick(
              originalTools.find((tool) => tool.name === value) ||
                ({} as ToolsItem),
            )
          }
        />
      </div>
      <div className="rounded-md border">
        <Table className="rounded-md overflow-hidden">
          <TableHeader className="bg-[var(--color-bg-neutral)] font-medium text-[var(--color-text-primary)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-12">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-0">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
                <TableHead key="actions" className="px-0 text-right">
                  <span className="whitespace-nowrap text-sm font-medium text-primary h-9 py-2 px-3">
                    Actions
                  </span>
                </TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="h-12 hover:bg-[var(--color-bg-modal-overlay)] transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                  <TableCell key={"actions"} className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        className="inline-flex self-end"
                      >
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!row.original.originalToolId ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleDetailsClick(row.original)}
                            >
                              Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleCreateClick(row.original)}
                            >
                              Customize
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {row.original.originalToolId ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleDetailsClick(row.original)}
                            >
                              Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleEditClick(row.original)}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicateClick(row.original)}
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteTool(row.original)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col justify-center items-center gap-2 p-4">
                    <Wrench className="w-8 mx-auto text-[var(--color-fg-info)]" />
                    <p className="text-sm text-[var(--color-fg-info)]">
                      No results found
                    </p>
                    <Button
                      onClick={clearFilters}
                      variant="outline"
                      className="px-2"
                    >
                      <CircleX className="w-4 h-4 mr-2" />
                      Clear Filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground flex-1 text-sm">
          Showing {pageIndex * pageSize + 1} to{" "}
          {Math.min(
            (pageIndex + 1) * pageSize,
            table.getFilteredRowModel().rows.length,
          )}{" "}
          of {table.getFilteredRowModel().rows.length} results
        </div>
        <div className="space-x-2 flex items-center select-none">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ArrowRight className="mr-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
