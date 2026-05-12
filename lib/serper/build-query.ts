export type SerperSearchFacets = {
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  /** Texto extra (nome, empresa, palavras-chave) para enriquecer a busca Google. */
  q?: string;
};

/**
 * Monta uma única string de busca para o Serper (ordem estável: ramo → cidade → estado → país → texto livre).
 */
export function buildSerperSearchString(f: SerperSearchFacets): string {
  const parts = [
    f.category?.trim(),
    f.city?.trim(),
    f.state?.trim(),
    f.country?.trim(),
    f.q?.trim(),
  ].filter((p): p is string => Boolean(p && p.length > 0));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function inferGlFromCountry(country?: string): string | undefined {
  const t = country?.trim().toLowerCase() ?? "";
  if (!t) return undefined;
  if (t.includes("brasil") || t === "br" || t.includes("brazil")) return "br";
  if (t.includes("portugal") || t === "pt") return "pt";
  if (t.includes("estados unidos") || t.includes("united states") || t === "us" || t === "usa")
    return "us";
  return undefined;
}

/**
 * Parâmetros para o Serper `/maps`: termo de negócio + região (empresas locais, não SERP genérico).
 */
export function buildSerperMapsRequest(f: SerperSearchFacets): {
  mapsQ: string;
  location: string;
  gl?: string;
  hl: string;
} {
  const location = [f.city, f.state, f.country]
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x && x.length > 0))
    .join(", ");

  const kw = [f.category?.trim(), f.q?.trim()].filter((x): x is string => Boolean(x && x.length > 0));
  let mapsQ = kw.join(" ").trim();
  if (!mapsQ) {
    const locHint = [f.city, f.state].filter(Boolean).map((x) => String(x).trim()).join(" ").trim();
    mapsQ = locHint ? `empresas ${locHint}` : "estabelecimentos comerciais";
  }

  return {
    mapsQ: mapsQ.slice(0, 400),
    location: location.slice(0, 240),
    gl: inferGlFromCountry(f.country),
    hl: "pt-br",
  };
}
