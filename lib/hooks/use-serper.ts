"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { buildSerperSearchString, type SerperSearchFacets } from "@/lib/serper/build-query";
import type { SerperSearchApiResponse } from "@/lib/schemas/serper";

function facetsKey(f: SerperSearchFacets): string {
  return JSON.stringify({
    c: f.category?.trim() ?? "",
    ci: f.city?.trim() ?? "",
    s: f.state?.trim() ?? "",
    co: f.country?.trim() ?? "",
    q: f.q?.trim() ?? "",
  });
}

/**
 * Busca Google Maps via Serper (empresas locais). Só dispara quando `enabled` é true no caller
 * e a string composta dos facets tem entre 4 e 500 caracteres (validação alinhada ao GET da API).
 */
export function useSerperLeadsQuery(facets: SerperSearchFacets, options?: { enabled?: boolean }) {
  const composed = buildSerperSearchString(facets);
  const enabled =
    (options?.enabled ?? true) &&
    composed.length >= 4 &&
    composed.length <= 500;

  return useQuery({
    queryKey: ["serper", facetsKey(facets)],
    enabled,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 48,
    queryFn: async () => {
      try {
        const { data } = await api.get<SerperSearchApiResponse>("/search/serper", {
          params: {
            category: facets.category?.trim() || undefined,
            city: facets.city?.trim() || undefined,
            state: facets.state?.trim() || undefined,
            country: facets.country?.trim() || undefined,
            q: facets.q?.trim() || undefined,
          },
        });
        return data;
      } catch {
        return { leads: [], importCandidates: [], cached: false };
      }
    },
  });
}
