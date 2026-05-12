"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import { MapsProspectsTable } from "@/components/maps-prospects-table";
import { LeadsDataTable } from "@/components/leads-data-table";
import { STATUS_LABELS, type LeadStatus } from "@/lib/schemas/lead-status";
import { buildSerperSearchString, type SerperSearchFacets } from "@/lib/serper/build-query";
import type { SerperImportCandidate } from "@/lib/schemas/serper";
import { useImportWebLeadsMutation, useLeadsQuery } from "@/lib/hooks/use-leads";
import { useSerperLeadsQuery } from "@/lib/hooks/use-serper";
import { cn } from "@/lib/utils";

const emptyFacets: SerperSearchFacets = {
  category: "",
  city: "",
  state: "",
  country: "",
  q: "",
};

function inheritLocationFromFacets(f: SerperSearchFacets) {
  return {
    category: f.category?.trim() || undefined,
    city: f.city?.trim() || undefined,
    state: f.state?.trim() || undefined,
    country: f.country?.trim() || undefined,
  };
}

function StatusPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default function BuscaPage() {
  const router = useRouter();
  const [draftFacets, setDraftFacets] = useState<SerperSearchFacets>(emptyFacets);
  const [searchFacets, setSearchFacets] = useState<SerperSearchFacets | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "todos">("todos");
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const effectiveFacets = searchFacets ?? emptyFacets;

  const leadsQ = useLeadsQuery({ ...effectiveFacets, status: statusFilter });
  const serpQ = useSerperLeadsQuery(effectiveFacets, {
    enabled: hasSearched && statusFilter === "todos",
  });
  const importMut = useImportWebLeadsMutation();

  const dbRows = leadsQ.data?.leads ?? [];
  const importCandidates: SerperImportCandidate[] = useMemo(
    () => (statusFilter === "todos" ? (serpQ.data?.importCandidates ?? []) : []),
    [serpQ.data?.importCandidates, statusFilter],
  );

  const webLoading = hasSearched && statusFilter === "todos" && serpQ.isFetching;

  const setFacet = (key: keyof SerperSearchFacets, value: string) => {
    setDraftFacets((prev) => ({ ...prev, [key]: value }));
  };

  const runSearch = () => {
    setSearchHint(null);
    const composed = buildSerperSearchString(draftFacets);
    if (composed.length < 4 || composed.length > 500) {
      setSearchHint(
        "Informe ramo, localização ou texto — no mínimo 4 caracteres no total (e no máximo 500).",
      );
      return;
    }
    setSearchFacets({ ...draftFacets });
    setHasSearched(true);
  };

  const runImport = useCallback(
    async (items: SerperImportCandidate[]) => {
      setSearchHint(null);
      const inheritLocation = inheritLocationFromFacets(effectiveFacets);
      const hasLoc = Object.values(inheritLocation).some(Boolean);
      try {
        await importMut.mutateAsync({
          items,
          inheritLocation: hasLoc ? inheritLocation : undefined,
        });
        router.push("/");
      } catch (e) {
        setSearchHint(e instanceof Error ? e.message : "Falha na importação.");
      }
    },
    [effectiveFacets, importMut, router],
  );

  const handleImportOne = useCallback(
    (c: SerperImportCandidate) => {
      void runImport([c]);
    },
    [runImport],
  );

  const handleImportAll = useCallback(() => {
    void runImport(importCandidates.slice(0, 25));
  }, [importCandidates, runImport]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-16">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Prospecção
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Busca de leads</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Defina ramo e região, clique em <span className="text-foreground">Buscar</span> e revise os
          estabelecimentos do Google Maps. Importar envia para a{" "}
          <Link href="/" className="text-foreground underline underline-offset-4">
            listagem principal
          </Link>
          .
        </p>
      </header>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Filtros de busca</CardTitle>
          <CardDescription>
            A consulta no Maps usa estes campos; os filtros de status abaixo aplicam-se à tabela da
            sua base.
          </CardDescription>
        </CardHeader>
        <CardPanel className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="busca-category">Ramo / nicho / categoria</Label>
            <Input
              id="busca-category"
              placeholder="Ex.: odontologia, SaaS B2B…"
              value={draftFacets.category ?? ""}
              onChange={(e) => setFacet("category", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="busca-city">Cidade</Label>
              <Input
                id="busca-city"
                placeholder="Cidade"
                value={draftFacets.city ?? ""}
                onChange={(e) => setFacet("city", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="busca-state">Estado</Label>
              <Input
                id="busca-state"
                placeholder="UF ou estado"
                value={draftFacets.state ?? ""}
                onChange={(e) => setFacet("state", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="busca-country">País</Label>
              <Input
                id="busca-country"
                placeholder="País"
                value={draftFacets.country ?? ""}
                onChange={(e) => setFacet("country", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="busca-q">Texto livre (opcional)</Label>
            <Input
              id="busca-q"
              placeholder="Palavras-chave extras…"
              value={draftFacets.q ?? ""}
              onChange={(e) => setFacet("q", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" className="w-full gap-2 sm:w-auto" onClick={runSearch} loading={serpQ.isFetching}>
              <Search className="size-4" aria-hidden />
              Buscar no Maps
            </Button>
            {searchHint ? (
              <p className="text-sm text-destructive" role="alert">
                {searchHint}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-6">
            <span className="mr-2 self-center text-xs font-medium text-muted-foreground">Base:</span>
            <StatusPill active={statusFilter === "todos"} onClick={() => setStatusFilter("todos")}>
              Todos
            </StatusPill>
            {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((status) => (
              <StatusPill
                key={status}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {STATUS_LABELS[status]}
              </StatusPill>
            ))}
          </div>
        </CardPanel>
      </Card>

      {statusFilter === "todos" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <MapPin className="size-5 text-muted-foreground" aria-hidden />
                Resultados do Maps
              </h2>
              <p className="text-sm text-muted-foreground">
                {!hasSearched
                  ? "Preencha os filtros e use Buscar para carregar estabelecimentos."
                  : "Empresas locais com site ou ficha no Maps."}
              </p>
            </div>
            {hasSearched && importCandidates.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-2"
                disabled={importMut.isPending || webLoading}
                onClick={handleImportAll}
              >
                Importar todos ({Math.min(importCandidates.length, 25)})
              </Button>
            ) : null}
          </div>

          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-20 text-center">
              <Search className="mb-3 size-10 text-muted-foreground/40" aria-hidden />
              <p className="text-sm font-medium text-foreground">Nenhuma busca ainda</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Os resultados do Maps aparecerão aqui em formato de tabela, logo após o primeiro
                carregamento.
              </p>
            </div>
          ) : (
            <MapsProspectsTable
              rows={importCandidates}
              isLoading={webLoading}
              importPending={importMut.isPending}
              onImportRow={handleImportOne}
            />
          )}
        </section>
      )}

    </div>
  );
}
