import { createHash } from "node:crypto";
import {
  serperMapsResponseSchema,
  serperSearchResponseSchema,
  type SerperMapsPlace,
  type SerperMapsResponse,
  type SerperSearchResponse,
} from "@/lib/schemas/serper";
import {
  extractEmailsFromText,
  isLikelyContactEmail,
} from "@/lib/lead-display";
import { leadSiteHostname } from "@/lib/serper/url-host";

const SERPER_MAPS_URL = "https://google.serper.dev/maps";

export function normalizeSerperQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export function webLeadIdFromLink(link: string): string {
  const h = createHash("sha256").update(link).digest("hex").slice(0, 20);
  return `web:${h}`;
}

export function fallbackCompany(snippet: string | undefined, title: string | undefined): string {
  const firstLine = (snippet ?? "").split(/[.\n]/)[0]?.trim() ?? "";
  const looksLikePhone =
    firstLine.length >= 8 &&
    (firstLine.replace(/\D/g, "").length / Math.max(firstLine.length, 1)) > 0.55;
  if (firstLine.length > 2 && !looksLikePhone) return firstLine.slice(0, 120);
  const t = (title ?? "").split(/[|\-–]/)[0]?.trim();
  return t && t.length > 2 ? t.slice(0, 120) : "—";
}

function prospectUrlDedupeKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
    return `${host}${path}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function titleTokens(title: string): string[] {
  const stop = new Set([
    "com",
    "org",
    "ltda",
    "eireli",
    "mei",
    "filial",
    "loja",
    "store",
    "shop",
    "the",
    "and",
    "for",
    "www",
  ]);
  return title
    .toLowerCase()
    .split(/[^a-z0-9áàãâéêíóôõúç]+/u)
    .filter((w) => w.length >= 3 && !stop.has(w))
    .slice(0, 12);
}

export function mergeOrganicSearchResponses(
  parts: (SerperSearchResponse | null | undefined)[],
): SerperSearchResponse {
  const seen = new Set<string>();
  const organic: NonNullable<SerperSearchResponse["organic"]> = [];
  for (const part of parts) {
    for (const item of part?.organic ?? []) {
      const key = `${item.link ?? ""}|${item.title ?? ""}|${item.snippet ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      organic.push(item);
    }
  }
  return serperSearchResponseSchema.parse({ organic });
}

/** Consultas orgânicas focadas (uma por estabelecimento com prioridade para quem tem site). */
export function buildPerPlaceEmailQueries(
  places: SerperMapsPlace[] | undefined,
  facets: { city?: string; state?: string },
  maxQueries: number,
): string[] {
  const locStr = [facets.city, facets.state].filter(Boolean).join(" ").trim().slice(0, 120);
  const sorted = [...(places ?? [])].sort((a, b) => {
    const aw = a.website?.trim() ? 1 : 0;
    const bw = b.website?.trim() ? 1 : 0;
    return bw - aw;
  });

  const queries: string[] = [];
  const seenQ = new Set<string>();

  for (const p of sorted) {
    const title = p.title?.trim();
    if (!title) continue;
    const host = leadSiteHostname(p.website);
    const safeTitle = title.replace(/"/g, "").slice(0, 120);

    const pushQ = (raw: string) => {
      const q = raw.replace(/\s+/g, " ").trim().slice(0, 480);
      const key = normalizeSerperQuery(q);
      if (key.length < 6 || seenQ.has(key)) return false;
      seenQ.add(key);
      queries.push(q);
      return true;
    };

    if (host) {
      void pushQ(`site:${host} contato email comercial`);
      if (queries.length < maxQueries) {
        const alt = `${safeTitle} ${locStr} email`.replace(/\s+/g, " ").trim();
        if (alt.length >= 8) void pushQ(alt);
      }
    } else {
      void pushQ(`${safeTitle} ${locStr} email contato`.replace(/\s+/g, " ").trim());
    }
    if (queries.length >= maxQueries) break;
  }
  return queries;
}

export async function fetchSerperSearchesBatched(
  queries: string[],
  opts: { hl: string; gl?: string; num?: number; concurrency?: number },
): Promise<SerperSearchResponse> {
  if (queries.length === 0) return serperSearchResponseSchema.parse({ organic: [] });
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  const merged: NonNullable<SerperSearchResponse["organic"]> = [];
  const seen = new Set<string>();

  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((q) =>
        fetchSerperSearch({
          q,
          hl: opts.hl,
          gl: opts.gl,
          num: opts.num ?? 10,
        }).catch(() => serperSearchResponseSchema.parse({ organic: [] })),
      ),
    );
    for (const r of results) {
      for (const item of r.organic ?? []) {
        const k = `${item.link ?? ""}|${item.snippet ?? ""}`;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(item);
      }
    }
  }
  return serperSearchResponseSchema.parse({ organic: merged });
}

/** E-mail claramente ligado ao site do estabelecimento no Maps (evita e-mail de diretório genérico). */
function isTrustedEmailForPlace(
  p: SerperMapsPlace,
  email: string,
  item: { link?: string | null },
): boolean {
  const placeWebsiteHost = leadSiteHostname(p.website);
  if (!placeWebsiteHost) return false;
  const emailHost = (email.split("@")[1] ?? "").toLowerCase().replace(/^www\./, "");
  if (!emailHost) return false;
  const link = (item.link ?? "").toLowerCase();
  const linkHost = leadSiteHostname(item.link);
  if (
    emailHost === placeWebsiteHost ||
    emailHost.endsWith(`.${placeWebsiteHost}`) ||
    placeWebsiteHost.endsWith(`.${emailHost}`)
  ) {
    return true;
  }
  if (
    linkHost &&
    (placeWebsiteHost === linkHost ||
      placeWebsiteHost.endsWith(`.${linkHost}`) ||
      linkHost.endsWith(`.${placeWebsiteHost}`))
  ) {
    return true;
  }
  if (link.includes(placeWebsiteHost)) return true;
  return false;
}

type OrganicEmailRank = {
  email: string;
  score: number;
  tokenHits: number;
  trusted: boolean;
  /** E-mail visível no snippet e link orgânico de rede social (critério extra para fraco). */
  relaxedWeakEligible: boolean;
};

const SOCIAL_BRAND_HOST_SUFFIXES = [
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "m.facebook.com",
  "l.facebook.com",
  "l.instagram.com",
];

function isSocialBrandLinkHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return SOCIAL_BRAND_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/** Agrega melhor pontuação por e-mail a partir da SERP orgânica (vários resultados). */
function rankOrganicEmailsForPlace(
  p: SerperMapsPlace,
  organic: SerperSearchResponse | null | undefined,
  locHint?: { city?: string; state?: string },
): OrganicEmailRank[] {
  const placeWebsiteHost = leadSiteHostname(p.website);
  const tokens = titleTokens(p.title ?? "");
  const cityLc = locHint?.city?.trim().toLowerCase();
  const stateLc = locHint?.state?.trim().toLowerCase();
  const addrLc = (p.address ?? "").toLowerCase();

  const byEmail = new Map<string, OrganicEmailRank>();

  const organicList = organic?.organic ?? [];
  for (let idx = 0; idx < organicList.length; idx++) {
    const item = organicList[idx]!;
    const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
    const link = (item.link ?? "").toLowerCase();
    const linkHost = leadSiteHostname(item.link);
    const emails = extractEmailsFromText(text).filter(isLikelyContactEmail);
    const textLower = text.toLowerCase();
    const positionBonus = Math.max(0, 10 - Math.min(idx, 9));
    let tokenHits = 0;
    for (const w of tokens) {
      if (textLower.includes(w)) tokenHits += 1;
    }

    for (const email of emails) {
      let score = positionBonus;
      const emailHost = (email.split("@")[1] ?? "").toLowerCase().replace(/^www\./, "");
      const snippetLower = (item.snippet ?? "").toLowerCase();
      const relaxedWeakEligible =
        snippetLower.includes(email.toLowerCase()) && isSocialBrandLinkHost(linkHost);

      if (
        placeWebsiteHost &&
        linkHost &&
        (placeWebsiteHost === linkHost ||
          placeWebsiteHost.endsWith(`.${linkHost}`) ||
          linkHost.endsWith(`.${placeWebsiteHost}`))
      ) {
        score += 120;
      }
      if (placeWebsiteHost && link.includes(placeWebsiteHost)) {
        score += 45;
      }
      if (
        placeWebsiteHost &&
        emailHost &&
        (emailHost === placeWebsiteHost ||
          emailHost.endsWith(`.${placeWebsiteHost}`) ||
          placeWebsiteHost.endsWith(`.${emailHost}`))
      ) {
        score += 100;
      }
      if (cityLc && cityLc.length > 2 && (textLower.includes(cityLc) || addrLc.includes(cityLc))) {
        score += 8;
      }
      if (stateLc && stateLc.length > 1 && (textLower.includes(stateLc) || addrLc.includes(stateLc))) {
        score += 4;
      }
      for (const w of tokens) {
        if (textLower.includes(w)) score += 2;
      }
      if (p.type?.trim() && textLower.includes(p.type.trim().toLowerCase())) score += 6;

      const trusted = isTrustedEmailForPlace(p, email, item);
      const key = email.toLowerCase();
      const prev = byEmail.get(key);
      if (!prev) {
        byEmail.set(key, { email, score, tokenHits, trusted, relaxedWeakEligible });
      } else {
        byEmail.set(key, {
          email,
          score: Math.max(prev.score, score),
          tokenHits: Math.max(prev.tokenHits, tokenHits),
          trusted: prev.trusted || trusted,
          relaxedWeakEligible: prev.relaxedWeakEligible || relaxedWeakEligible,
        });
      }
    }
  }

  return [...byEmail.values()].sort((a, b) => b.score - a.score);
}

const MIN_TRUSTED_SCORE = 4;
/** Fraco “normal”: precisa de bons sinais de contexto na SERP. */
const MIN_WEAK_SCORE = 24;
const MIN_WEAK_TOKEN_HITS = 2;
/** Fraco com e-mail no snippet e link de rede social da marca. */
const MIN_WEAK_RELAXED_SCORE = 18;

/**
 * Escolhe e-mail para um lugar. E-mails “fracos” (sem vínculo com o site do Maps) só podem ser usados
 * uma vez por lote — evita o mesmo contato de agência/diretório para todos os resultados.
 */
export function pickEmailForPlaceInBatch(
  p: SerperMapsPlace,
  organic: SerperSearchResponse | null | undefined,
  locHint: { city?: string; state?: string; country?: string } | undefined,
  usedWeakEmails: Set<string>,
  siteHostEmails?: Record<string, string>,
): string | undefined {
  const host = leadSiteHostname(p.website);
  if (host && siteHostEmails?.[host]) {
    const scraped = siteHostEmails[host];
    if (scraped && isLikelyContactEmail(scraped)) {
      return scraped.slice(0, 320);
    }
  }

  const mapSnippet = snippetFromPlace(p);
  const fromMaps = extractEmailsFromText(mapSnippet).find(isLikelyContactEmail);
  if (fromMaps) return fromMaps.slice(0, 320);

  const ranked = rankOrganicEmailsForPlace(p, organic, locHint);
  for (const c of ranked) {
    if (c.trusted && c.score >= MIN_TRUSTED_SCORE) {
      return c.email.slice(0, 320);
    }
    if (c.trusted) continue;
    const el = c.email.toLowerCase();
    if (usedWeakEmails.has(el)) continue;

    const strongWeak =
      c.score >= MIN_WEAK_SCORE && c.tokenHits >= MIN_WEAK_TOKEN_HITS;
    const relaxedWeak =
      c.relaxedWeakEligible &&
      c.score >= MIN_WEAK_RELAXED_SCORE &&
      c.tokenHits >= 1;

    if (strongWeak || relaxedWeak) {
      usedWeakEmails.add(el);
      return c.email.slice(0, 320);
    }
  }
  return undefined;
}

/** Conta itens orgânicos cujo título ou snippet contém e-mail de contacto plausível. */
export function countOrganicItemsWithVisibleEmail(
  organic: SerperSearchResponse | null | undefined,
): number {
  let n = 0;
  for (const item of organic?.organic ?? []) {
    const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
    if (extractEmailsFromText(text).some(isLikelyContactEmail)) n += 1;
  }
  return n;
}

function phoneFromPlace(p: SerperMapsPlace): string {
  const ext = p as SerperMapsPlace & { phone?: string };
  return (ext.phoneNumber ?? ext.phone ?? "").trim();
}

function placeCandidateUrl(p: SerperMapsPlace): string | null {
  const w = p.website?.trim();
  if (w) {
    const u = w.startsWith("http://") || w.startsWith("https://") ? w : `https://${w}`;
    try {
      new URL(u);
      return u;
    } catch {
      return null;
    }
  }
  const pid = p.placeId?.trim();
  if (pid) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pid)}`;
  }
  const q = encodeURIComponent([p.title, p.address].filter(Boolean).join(" ").trim());
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function snippetFromPlace(p: SerperMapsPlace): string {
  const bits: string[] = [];
  if (p.address?.trim()) bits.push(p.address.trim());
  const ph = phoneFromPlace(p);
  if (ph) bits.push(ph);
  if (p.type?.trim()) bits.push(p.type.trim());
  if (p.description?.trim()) bits.push(p.description.trim().slice(0, 220));
  if (p.rating != null) {
    bits.push(`${p.rating}★${p.ratingCount != null ? ` (${p.ratingCount} aval.)` : ""}`);
  }
  return bits.join(" · ").slice(0, 500);
}

export function buildSerperMapsLeadBundle(
  parsed: SerperMapsResponse,
  organic: SerperSearchResponse | null | undefined,
  loc: { category?: string; city?: string; state?: string; country?: string },
  siteHostEmails?: Record<string, string>,
): {
  leads: {
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    category: string;
    city: string;
    state: string;
    country: string;
    status: "novo";
    createdAt: string;
    source: "web";
    url: string;
  }[];
  importCandidates: { title: string; url: string; snippet?: string; email?: string }[];
} {
  const places = parsed.places ?? [];
  const now = new Date().toISOString();
  const cat = loc.category?.trim() ?? "";
  const city = loc.city?.trim() ?? "";
  const state = loc.state?.trim() ?? "";
  const country = loc.country?.trim() ?? "";

  const seen = new Set<string>();
  const usedWeakEmails = new Set<string>();
  const importCandidates: { title: string; url: string; snippet?: string; email?: string }[] = [];
  const leads: {
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    category: string;
    city: string;
    state: string;
    country: string;
    status: "novo";
    createdAt: string;
    source: "web";
    url: string;
  }[] = [];

  for (const p of places) {
    const title = p.title?.trim();
    if (!title) continue;
    const url = placeCandidateUrl(p);
    if (!url) continue;
    const dedupeKey = prospectUrlDedupeKey(url);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const snippet = snippetFromPlace(p);
    const email = pickEmailForPlaceInBatch(p, organic, loc, usedWeakEmails, siteHostEmails);

    importCandidates.push({
      title: title.slice(0, 300),
      url,
      snippet: snippet.length > 0 ? snippet : undefined,
      ...(email ? { email } : {}),
    });

    const id = webLeadIdFromLink(url);
    const phone = phoneFromPlace(p) || "—";
    leads.push({
      id,
      name: (p.title ?? "—").slice(0, 500),
      email: email ?? "—",
      phone,
      company: (p.title ?? "—").slice(0, 200),
      category: cat || (p.type ?? "").slice(0, 200),
      city,
      state,
      country,
      status: "novo" as const,
      createdAt: now,
      source: "web" as const,
      url,
    });
  }

  return {
    leads,
    importCandidates: importCandidates.slice(0, 25),
  };
}

export function buildPlacesImportCandidates(
  parsed: SerperMapsResponse,
  organic?: SerperSearchResponse | null,
  locHint?: { category?: string; city?: string; state?: string; country?: string },
) {
  return buildSerperMapsLeadBundle(parsed, organic, {
    category: locHint?.category ?? "",
    city: locHint?.city ?? "",
    state: locHint?.state ?? "",
    country: locHint?.country ?? "",
  }, undefined).importCandidates;
}

export function mapPlacesToLeadRows(
  parsed: SerperMapsResponse,
  loc?: { category?: string; city?: string; state?: string; country?: string },
  organic?: SerperSearchResponse | null,
) {
  return buildSerperMapsLeadBundle(parsed, organic, {
    category: loc?.category ?? "",
    city: loc?.city ?? "",
    state: loc?.state ?? "",
    country: loc?.country ?? "",
  }, undefined).leads;
}

export async function fetchSerperMaps(input: {
  mapsQ: string;
  location: string;
  gl?: string;
  hl: string;
}): Promise<SerperMapsResponse> {
  const key = process.env.SERPER_API_KEY;
  if (!key) {
    throw new Error("SERPER_API_KEY não configurada.");
  }

  const body: Record<string, unknown> = {
    q: input.mapsQ,
    num: 10,
    hl: input.hl,
  };
  if (input.location.trim()) body.location = input.location;
  if (input.gl) body.gl = input.gl;

  const res = await fetch(SERPER_MAPS_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Serper Maps: ${res.status} ${text.slice(0, 200)}`);
  }

  const json: unknown = await res.json();
  return serperMapsResponseSchema.parse(json);
}

const SERPER_SEARCH_URL = "https://google.serper.dev/search";

export async function fetchSerperSearch(input: {
  q: string;
  num?: number;
  hl?: string;
  gl?: string;
}): Promise<SerperSearchResponse> {
  const key = process.env.SERPER_API_KEY;
  if (!key) {
    throw new Error("SERPER_API_KEY não configurada.");
  }

  const body: Record<string, unknown> = {
    q: input.q.slice(0, 480),
    num: input.num ?? 15,
    hl: input.hl ?? "pt-br",
  };
  if (input.gl) body.gl = input.gl;

  const res = await fetch(SERPER_SEARCH_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Serper Search: ${res.status} ${text.slice(0, 200)}`);
  }

  const json: unknown = await res.json();
  return serperSearchResponseSchema.parse(json);
}
