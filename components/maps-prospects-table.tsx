"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type PaginationState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardFrame, CardFrameFooter } from "@/components/ui/card";
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
import type { SerperImportCandidate } from "@/lib/schemas/serper";
import { cn } from "@/lib/utils";

export type MapsProspectsTableProps = {
  rows: SerperImportCandidate[];
  isLoading: boolean;
  importPending: boolean;
  onImportRow: (row: SerperImportCandidate) => void;
  emptyHint?: string;
};

export function MapsProspectsTable({
  rows,
  isLoading,
  importPending,
  onImportRow,
  emptyHint = "Nenhum estabelecimento encontrado para estes filtros.",
}: MapsProspectsTableProps) {
  const pageSize = 8;

  const columns = useMemo<ColumnDef<SerperImportCandidate>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Estabelecimento",
        size: 220,
        cell: ({ row }) => (
          <div className="min-w-0 font-medium leading-snug" title={row.original.title}>
            <span className="line-clamp-2">{row.original.title}</span>
          </div>
        ),
      },
      {
        accessorKey: "snippet",
        header: "Detalhes",
        size: 280,
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original.snippet?.trim();
          return (
            <div
              className="max-w-full whitespace-normal text-muted-foreground leading-relaxed line-clamp-3 text-xs"
              title={s}
            >
              {s || "—"}
            </div>
          );
        },
      },
      {
        accessorKey: "url",
        header: "Site / link",
        size: 200,
        cell: ({ row }) => {
          const url = row.original.url;
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 max-w-full items-center gap-1 text-primary underline-offset-4 hover:underline"
              title={url}
            >
              <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate text-xs">{url.replace(/^https?:\/\//, "")}</span>
            </a>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Ações</span>,
        size: 120,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="secondary"
            className="w-full gap-1.5 whitespace-nowrap"
            disabled={importPending}
            onClick={() => onImportRow(row.original)}
          >
            <Download className="size-3.5" aria-hidden />
            Importar
          </Button>
        ),
      },
    ],
    [importPending, onImportRow],
  );

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  });

  if (isLoading) {
    return (
      <CardFrame className="w-full">
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
          <span className="inline-block size-5 animate-pulse rounded-full bg-muted" aria-hidden />
          Buscando no Maps…
        </div>
      </CardFrame>
    );
  }

  if (rows.length === 0) {
    return (
      <CardFrame className="w-full">
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">{emptyHint}</div>
      </CardFrame>
    );
  }

  return (
    <CardFrame className="w-full">
      <Table variant="card" className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow className="hover:bg-transparent" key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="min-w-0"
                  style={
                    header.column.getSize()
                      ? { width: `${header.column.getSize()}px` }
                      : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={`${row.original.url}#${row.id}`}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "min-w-0 align-top",
                    cell.column.id === "snippet" && "whitespace-normal",
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CardFrameFooter className="border-t border-border/60 bg-muted/30 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{rows.length}</strong>{" "}
            {rows.length === 1 ? "resultado" : "resultados"} do Maps
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={Array.from({ length: table.getPageCount() }, (_, i) => {
                const start = i * pageSize + 1;
                const end = Math.min((i + 1) * pageSize, rows.length);
                return { label: `Página ${i + 1} (${start}–${end})`, value: i + 1 };
              })}
              onValueChange={(value) => table.setPageIndex((Number(value) || 1) - 1)}
              value={table.getState().pagination.pageIndex + 1}
            >
              <SelectTrigger className="w-[min(100%,220px)]" size="sm" aria-label="Página">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {Array.from({ length: table.getPageCount() }, (_, i) => (
                  <SelectItem key={i + 1} value={i + 1}>
                    {i + 1}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Pagination className="justify-end">
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
        </div>
      </CardFrameFooter>
    </CardFrame>
  );
}
