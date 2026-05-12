"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDownIcon, ChevronUpIcon, ListPlus, CheckCircle2, Trash2, ListChecks } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardFrame, CardFrameFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeadPublic } from "@/lib/schemas/lead";
import { STATUS_LABELS } from "@/lib/schemas/lead-status";
import { useLeadsStore } from "@/store/leads";
import { formatPtDate } from "@/lib/format";
import {
  formatLeadEmailForTable,
  formatLeadPhoneForTable,
  isSyntheticWebImportEmail,
} from "@/lib/lead-display";
import { useBulkDeleteLeadsMutation, useDeleteLeadMutation } from "@/lib/hooks/use-leads";
import { cn } from "@/lib/utils";

type ColW = { w: string };

function headerWidths(showLastEmail: boolean): Record<string, string> {
  if (showLastEmail) {
    return {
      select: "3%",
      name: "14%",
      email: "13%",
      phone: "8%",
      company: "12%",
      category: "7%",
      local: "11%",
      status: "7%",
      createdAt: "7%",
      lastEmail: "6%",
      actions: "6%",
      delete: "6%",
    };
  }
  return {
    select: "3%",
    name: "15%",
    email: "14%",
    phone: "9%",
    company: "13%",
    category: "8%",
    local: "12%",
    status: "8%",
    createdAt: "8%",
    actions: "6%",
    delete: "4%",
  };
}

function CellText({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 truncate text-left", className)} title={title}>
      {children}
    </div>
  );
}

function colStyle(column: { columnDef: { meta?: unknown } }) {
  const w = (column.columnDef.meta as ColW | undefined)?.w;
  return w ? { width: w, maxWidth: w } : {};
}

export type LeadsDataTableProps = {
  leads: LeadPublic[];
  isPending: boolean;
  isError?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  showLastEmailColumn?: boolean;
  /** Barra “adicionar à fila” / “excluir” em massa (listagem principal). */
  showBulkToolbar?: boolean;
};

export function LeadsDataTable({
  leads,
  isPending,
  isError = false,
  pageSize = 10,
  emptyMessage = "Nenhum resultado.",
  showLastEmailColumn = true,
  showBulkToolbar = true,
}: LeadsDataTableProps) {
  const { sendListIds, toggleSendListId, addSendListIds } = useLeadsStore();
  const deleteMut = useDeleteLeadMutation();
  const bulkDeleteMut = useBulkDeleteLeadsMutation();
  const [leadToDelete, setLeadToDelete] = useState<LeadPublic | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const widths = useMemo(() => headerWidths(showLastEmailColumn), [showLastEmailColumn]);
  const w = (id: keyof typeof widths | string) => ({ meta: { w: widths[id] ?? "auto" } as ColW });

  const columns = useMemo<ColumnDef<LeadPublic>[]>(() => {
    const base: ColumnDef<LeadPublic>[] = [];

    if (showBulkToolbar) {
      base.push({
        ...w("select"),
        id: "select",
        cell: ({ row }) => (
          <Checkbox
            aria-label="Selecionar linha"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        ),
        enableSorting: false,
        header: ({ table }) => {
          const isAllSelected = table.getIsAllPageRowsSelected();
          const isSomeSelected = table.getIsSomePageRowsSelected();
          return (
            <Checkbox
              aria-label="Selecionar página"
              checked={isAllSelected}
              indeterminate={isSomeSelected && !isAllSelected}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            />
          );
        },
      });
    }

    base.push(
      {
        ...w("name"),
        accessorKey: "name",
        header: "Nome",
        cell: ({ row }) => (
          <CellText title={row.original.name}>{row.original.name}</CellText>
        ),
      },
      {
        ...w("email"),
        accessorKey: "email",
        header: "E-mail",
        cell: ({ row }) => {
          const raw = row.original.email ?? "";
          const shown = formatLeadEmailForTable(raw);
          const title = isSyntheticWebImportEmail(raw)
            ? "Sem e-mail de contato (importação web). Edite o lead para informar um e-mail."
            : raw || undefined;
          return (
            <CellText className="text-sm" title={title}>
              {shown}
            </CellText>
          );
        },
      },
      {
        ...w("phone"),
        accessorKey: "phone",
        header: "Telefone",
        cell: ({ row }) => {
          const raw = row.original.phone ?? "";
          const shown = formatLeadPhoneForTable(raw);
          return (
            <CellText className="tabular-nums text-sm" title={raw?.trim() || undefined}>
              {shown}
            </CellText>
          );
        },
      },
      {
        ...w("company"),
        accessorKey: "company",
        header: "Empresa",
        cell: ({ row }) => (
          <CellText title={row.original.company || undefined}>
            {row.original.company?.trim() || "—"}
          </CellText>
        ),
      },
      {
        ...w("category"),
        accessorKey: "category",
        header: "Ramo",
        cell: ({ row }) => (
          <CellText title={(row.original.category as string) || undefined}>
            {(row.original.category as string)?.trim() || "—"}
          </CellText>
        ),
      },
      {
        ...w("local"),
        id: "local",
        header: "Local",
        enableSorting: false,
        cell: ({ row }) => {
          const l = row.original;
          const parts = [l.city, l.state, l.country].filter((p) => p?.trim());
          const text = parts.length ? parts.join(", ") : "—";
          return <CellText title={text}>{text}</CellText>;
        },
      },
      {
        ...w("status"),
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as keyof typeof STATUS_LABELS;
          return (
            <Badge variant="outline" className="whitespace-nowrap font-normal">
              {STATUS_LABELS[status]}
            </Badge>
          );
        },
      },
      {
        ...w("createdAt"),
        accessorKey: "createdAt",
        header: "Cadastro",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-sm text-muted-foreground">
            {formatPtDate(row.getValue("createdAt") as string)}
          </span>
        ),
      },
    );

    if (showLastEmailColumn) {
      base.push({
        ...w("lastEmail"),
        id: "lastEmail",
        header: "Últ. envio",
        enableSorting: false,
        cell: ({ row }) => {
          const iso = row.original.lastEmailSentAt;
          return (
            <span className="whitespace-nowrap tabular-nums text-sm text-muted-foreground">
              {iso ? formatPtDate(iso) : "—"}
            </span>
          );
        },
      });
    }

    base.push({
      ...w("actions"),
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Fila</span>,
      cell: ({ row }) => {
        const inList = sendListIds.includes(row.original.id);
        const isWeb = row.original.source === "web";
        return (
          <Button
            size="icon"
            variant={inList ? "secondary" : "ghost"}
            className="size-8 shrink-0"
            title={
              isWeb
                ? "Pré-visualização web não entra na fila"
                : inList
                  ? "Remover da lista de envios"
                  : "Adicionar à lista de envios"
            }
            disabled={isWeb}
            onClick={() => !isWeb && toggleSendListId(row.original.id)}
          >
            {inList ? <CheckCircle2 className="size-4" /> : <ListPlus className="size-4" />}
          </Button>
        );
      },
    });

    base.push({
      ...w("delete"),
      id: "delete",
      enableSorting: false,
      header: () => <span className="sr-only">Excluir</span>,
      cell: ({ row }) => (
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          title="Excluir lead"
          disabled={deleteMut.isPending || bulkDeleteMut.isPending}
          onClick={() => setLeadToDelete(row.original)}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    });

    return base;
  }, [bulkDeleteMut.isPending, deleteMut.isPending, sendListIds, showBulkToolbar, showLastEmailColumn, toggleSendListId, widths]);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const [sorting, setSorting] = useState<SortingState>([{ desc: false, id: "name" }]);

  const table = useReactTable({
    columns,
    data: leads,
    getRowId: (row) => row.id,
    enableRowSelection: showBulkToolbar,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: { pagination, sorting, rowSelection },
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const selectedIds = selectedRows.map((r) => r.original.id);
  const selectedAddableIds = selectedRows
    .filter((r) => r.original.source !== "web")
    .map((r) => r.original.id);

  const confirmDelete = () => {
    if (!leadToDelete) return;
    deleteMut.mutate(leadToDelete.id, {
      onSuccess: () => {
        setLeadToDelete(null);
        setRowSelection((prev) => {
          const next = { ...prev };
          delete next[leadToDelete.id];
          return next;
        });
      },
    });
  };

  const handleBulkAddToQueue = () => {
    if (selectedAddableIds.length === 0) return;
    addSendListIds(selectedAddableIds);
    table.resetRowSelection();
  };

  const handleBulkDeleteConfirm = () => {
    if (selectedIds.length === 0) return;
    bulkDeleteMut.mutate(
      { ids: selectedIds },
      {
        onSuccess: () => {
          setBulkDeleteOpen(false);
          table.resetRowSelection();
        },
      },
    );
  };

  if (isPending) {
    return (
      <CardFrame className="w-full">
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
          <span className="inline-block size-5 animate-pulse rounded-full bg-muted" aria-hidden />
          Carregando leads…
        </div>
      </CardFrame>
    );
  }

  if (isError) {
    return (
      <CardFrame className="w-full">
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          Não foi possível carregar os leads.
        </div>
      </CardFrame>
    );
  }

  return (
    <>
      <Dialog open={leadToDelete != null} onOpenChange={(open) => !open && setLeadToDelete(null)}>
        <DialogPopup showCloseButton>
          <DialogHeader>
            <DialogTitle>Excluir lead?</DialogTitle>
            <DialogDescription>
              {leadToDelete ? (
                <>
                  Esta ação remove permanentemente{" "}
                  <strong className="text-foreground">{leadToDelete.name}</strong> e o histórico de
                  envios associado.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter variant="bare">
            <Button type="button" variant="outline" onClick={() => setLeadToDelete(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteMut.isPending}
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogPopup showCloseButton>
          <DialogHeader>
            <DialogTitle>Excluir {selectedCount} lead(s)?</DialogTitle>
            <DialogDescription>
              Os registros serão removidos da base e da fila de envio. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter variant="bare">
            <Button type="button" variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={bulkDeleteMut.isPending}
              onClick={handleBulkDeleteConfirm}
            >
              Excluir {selectedCount}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <CardFrame className="w-full overflow-hidden">
        {showBulkToolbar && selectedCount > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border/60 bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{selectedCount}</strong> selecionado
              {selectedCount === 1 ? "" : "s"} nesta página
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-2"
                disabled={selectedAddableIds.length === 0}
                onClick={handleBulkAddToQueue}
              >
                <ListChecks className="size-4" aria-hidden />
                Adicionar à fila ({selectedAddableIds.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-2"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden />
                Excluir selecionados
              </Button>
            </div>
          </div>
        ) : null}

        <div className="w-full overflow-x-hidden">
          <Table variant="card" className="w-full table-fixed">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow className="hover:bg-transparent" key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="min-w-0 px-2 py-2 text-left text-xs font-medium text-muted-foreground sm:px-2.5 sm:text-sm"
                      style={colStyle(header.column)}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className="flex cursor-pointer select-none items-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              header.column.getToggleSortingHandler()?.(e);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <span className="whitespace-nowrap">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {{
                            asc: (
                              <ChevronUpIcon aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
                            ),
                            desc: (
                              <ChevronDownIcon
                                aria-hidden="true"
                                className="size-3.5 shrink-0 opacity-70"
                              />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        <span className="whitespace-nowrap">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow data-state={row.getIsSelected() ? "selected" : undefined} key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="min-w-0 px-2 py-2 align-middle sm:px-2.5"
                        style={colStyle(cell.column)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-28 text-center text-muted-foreground" colSpan={columns.length}>
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <CardFrameFooter className="border-t border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Exibindo</span>
              <Select
                items={Array.from({ length: table.getPageCount() }, (_, i) => {
                  const start = i * table.getState().pagination.pageSize + 1;
                  const end = Math.min(
                    (i + 1) * table.getState().pagination.pageSize,
                    table.getRowCount(),
                  );
                  const pageNum = i + 1;
                  return { label: `${start}–${end}`, value: pageNum };
                })}
                onValueChange={(value) => {
                  table.setPageIndex((Number(value) || 1) - 1);
                }}
                value={table.getState().pagination.pageIndex + 1}
              >
                <SelectTrigger aria-label="Selecionar página" className="w-fit min-w-0" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {Array.from({ length: table.getPageCount() }, (_, i) => {
                    const start = i * table.getState().pagination.pageSize + 1;
                    const end = Math.min(
                      (i + 1) * table.getState().pagination.pageSize,
                      table.getRowCount(),
                    );
                    const pageNum = i + 1;
                    return (
                      <SelectItem key={pageNum} value={pageNum}>
                        {`${start}–${end}`}
                      </SelectItem>
                    );
                  })}
                </SelectPopup>
              </Select>
              <span>
                de <strong className="text-foreground">{table.getRowCount()}</strong> leads
              </span>
            </div>

            <Pagination className="justify-end sm:mx-0">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    className="sm:*:[svg]:hidden"
                    render={
                      <Button
                        disabled={!table.getCanPreviousPage()}
                        onClick={() => table.previousPage()}
                        size="sm"
                        variant="outline"
                      />
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    className="sm:*:[svg]:hidden"
                    render={
                      <Button
                        disabled={!table.getCanNextPage()}
                        onClick={() => table.nextPage()}
                        size="sm"
                        variant="outline"
                      />
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardFrameFooter>
      </CardFrame>
    </>
  );
}
