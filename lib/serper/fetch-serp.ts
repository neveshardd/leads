import { createHash } from "node:crypto";
import { serperMapsResponseSchema, type SerperMapsPlace, type SerperMapsResponse } from "@/lib/schemas/serper";

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

export function buildPlacesImportCandidates(parsed: SerperMapsResponse) {
  const places = parsed.places ?? [];
  const out: { title: string; url: string; snippet?: string }[] = [];
  const seen = new Set<string>();
  for (const p of places) {
    const title = p.title?.trim();
    if (!title) continue;
    const url = placeCandidateUrl(p);
    if (!url) continue;
    const dedupeKey = prospectUrlDedupeKey(url);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const snippet = snippetFromPlace(p);
    out.push({
      title: title.slice(0, 300),
      url,
      snippet: snippet.length > 0 ? snippet : undefined,
    });
  }
  return out.slice(0, 25);
}

export function mapPlacesToLeadRows(
  parsed: SerperMapsResponse,
  loc?: { category?: string; city?: string; state?: string; country?: string },
) {
  const places = parsed.places ?? [];
  const now = new Date().toISOString();
  const cat = loc?.category?.trim() ?? "";
  const city = loc?.city?.trim() ?? "";
  const state = loc?.state?.trim() ?? "";
  const country = loc?.country?.trim() ?? "";

  const seen = new Set<string>();
  const rows: {
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
    const url = placeCandidateUrl(p);
    if (!url) continue;
    const dedupeKey = prospectUrlDedupeKey(url);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const id = webLeadIdFromLink(url);
    const phone = phoneFromPlace(p) || "—";
    rows.push({
      id,
      name: (p.title ?? "—").slice(0, 500),
      email: "—",
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

  return rows;
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
