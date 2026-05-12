import type { SerperMapsPlace } from "@/lib/schemas/serper";
import { extractEmailsFromText, isLikelyContactEmail } from "@/lib/lead-display";
import { leadSiteHostname } from "@/lib/serper/url-host";

const MAX_HTML_BYTES = 350_000;
/** Orçamento total por host (várias URLs em sequência). */
const HOST_BUDGET_MS = 6800;
/** Máximo por pedido individual dentro do orçamento do host. */
const SINGLE_FETCH_MS = 3200;

const CONTACT_PATHS = ["", "/contato", "/contact", "/fale-conosco", "/contacto", "/sobre"];

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.7,en;q=0.5",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "[::1]" || h === "::1") return true;
  if (/^(127\.0\.0\.1|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) return true;
  return false;
}

function emailDomainMatchesHost(email: string, normHost: string): boolean {
  const eh = (email.split("@")[1] ?? "").toLowerCase().replace(/^www\./, "");
  if (!eh) return false;
  return eh === normHost || eh.endsWith(`.${normHost}`) || normHost.endsWith(`.${eh}`);
}

function pickBestEmailFromList(emails: string[], host: string): string | undefined {
  const normHost = host.toLowerCase().replace(/^www\./, "");
  const filtered = [...new Set(emails.map((e) => e.trim()).filter((e) => isLikelyContactEmail(e)))];
  if (filtered.length === 0) return undefined;
  const domainMatch = filtered.find((e) => emailDomainMatchesHost(e, normHost));
  return domainMatch ?? filtered[0];
}

function looksLikeHtml(slice: ArrayBuffer): boolean {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(slice.byteLength > 800 ? slice.slice(0, 800) : slice);
  const t = head.trimStart().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head") || t.startsWith("<!--");
}

function isProbablyHtmlContentType(ct: string): boolean {
  const c = ct.toLowerCase();
  return c.includes("text/html") || c.includes("application/xhtml");
}

function extractEmailsFromHtml(html: string): string[] {
  const fromText = extractEmailsFromText(html);
  const mailto = [...html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi)].map((m) => {
    const raw = (m[1] ?? "").split("?")[0] ?? "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  });
  return [...fromText, ...mailto];
}

/** Decodifica UTF-8 e latin1 e junta e-mails únicos (sites antigos em PT). */
function emailsFromBuffer(buf: ArrayBuffer): string[] {
  const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  const latin1 = new TextDecoder("latin1", { fatal: false }).decode(slice);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const html of [utf8, latin1]) {
    for (const e of extractEmailsFromHtml(html)) {
      const k = e.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
  }
  return out;
}

async function fetchEmailsFromUrl(href: string, deadlineMs: number): Promise<string[]> {
  const remaining = deadlineMs - Date.now();
  if (remaining < 400) return [];
  const timeout = Math.min(SINGLE_FETCH_MS, remaining);
  const ctrl = AbortSignal.timeout(Math.max(300, timeout));
  try {
    const res = await fetch(href, {
      method: "GET",
      redirect: "follow",
      signal: ctrl,
      headers: BROWSER_HEADERS,
    });
    const ct = res.headers.get("content-type") ?? "";
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 80) return [];

    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    const okHtml = isProbablyHtmlContentType(ct) || looksLikeHtml(slice);

    if (res.ok) {
      if (!okHtml) return [];
      return emailsFromBuffer(buf);
    }

    /* Alguns CDNs devolvem 403 com página estática ainda útil. */
    if (okHtml || looksLikeHtml(slice)) {
      return emailsFromBuffer(buf);
    }
    return [];
  } catch {
    return [];
  }
}

function buildUrlsToTry(baseHref: string): string[] {
  let u: URL;
  try {
    u = new URL(baseHref);
  } catch {
    return [];
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return [];
  const origin = `${u.protocol}//${u.host}`;
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const path of CONTACT_PATHS) {
    const next =
      path === ""
        ? `${origin}${u.pathname === "" || u.pathname === "/" ? "/" : u.pathname}${u.search}`
        : new URL(path, origin).href;
    const key = next.split("#")[0] ?? next;
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(next);
  }
  return urls;
}

/**
 * Percorre homepage + rotas de contacto até ao limite de tempo; para cedo se houver
 * e-mail com domínio alinhado ao site.
 */
export async function fetchEmailsFromWebsiteWithPaths(
  websiteRaw: string,
  normHost: string,
  hostBudgetMs: number = HOST_BUDGET_MS,
): Promise<{ emails: string[]; requestCount: number }> {
  const trimmed = websiteRaw.trim();
  if (!trimmed) return { emails: [], requestCount: 0 };
  const href = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return { emails: [], requestCount: 0 };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { emails: [], requestCount: 0 };
  if (isBlockedHostname(u.hostname)) return { emails: [], requestCount: 0 };

  const norm = normHost.toLowerCase().replace(/^www\./, "");
  const deadline = Date.now() + hostBudgetMs;
  const collected: string[] = [];
  let requestCount = 0;
  const urls = buildUrlsToTry(u.href);
  for (const url of urls) {
    if (Date.now() >= deadline) break;
    requestCount += 1;
    const emails = await fetchEmailsFromUrl(url, deadline);
    collected.push(...emails);
    const best = pickBestEmailFromList(collected, normHost);
    if (best && emailDomainMatchesHost(best, norm)) {
      break;
    }
  }
  return { emails: collected, requestCount };
}

/** GET da homepage (e rotas de contacto) e extrai e-mails do HTML. */
export async function fetchEmailsFromWebsiteHomepage(websiteRaw: string): Promise<string[]> {
  const trimmed = websiteRaw.trim();
  if (!trimmed) return [];
  const href = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
  const host = leadSiteHostname(trimmed);
  if (!host) {
    const one = await fetchEmailsFromUrl(href, Date.now() + SINGLE_FETCH_MS);
    return one;
  }
  const { emails } = await fetchEmailsFromWebsiteWithPaths(trimmed, host, HOST_BUDGET_MS);
  return emails;
}

export type SiteHostScrapeStats = {
  hostsAttempted: number;
  hostsWithEmail: number;
  httpRequests: number;
};

/**
 * Para cada site único dos resultados Maps, obtém o melhor e-mail (homepage + rotas comuns).
 * Roda em lotes para não estourar tempo na Vercel (limite de hosts).
 */
export async function scrapeSiteHostEmailsForPlaces(
  places: SerperMapsPlace[] | undefined,
  opts: { maxHosts?: number; concurrency?: number } = {},
): Promise<{ siteHostEmails: Record<string, string>; stats: SiteHostScrapeStats }> {
  const maxHosts = opts.maxHosts ?? 16;
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  const targets: { host: string; url: string }[] = [];
  const seenHosts = new Set<string>();

  for (const p of places ?? []) {
    const w = p.website?.trim();
    if (!w) continue;
    const host = leadSiteHostname(w);
    if (!host || seenHosts.has(host)) continue;
    seenHosts.add(host);
    const url = w.startsWith("http://") || w.startsWith("https://") ? w : `https://${w}`;
    try {
      new URL(url);
    } catch {
      continue;
    }
    targets.push({ host, url });
    if (targets.length >= maxHosts) break;
  }

  const siteHostEmails: Record<string, string> = {};
  let httpRequests = 0;

  for (let i = 0; i < targets.length; i += concurrency) {
    const chunk = targets.slice(i, i + concurrency);
    const partial = await Promise.all(
      chunk.map(async ({ host, url }) => {
        try {
          const { emails, requestCount } = await fetchEmailsFromWebsiteWithPaths(url, host, HOST_BUDGET_MS);
          const best = pickBestEmailFromList(emails, host);
          if (best) siteHostEmails[host] = best.slice(0, 320);
          return requestCount;
        } catch {
          return 0;
        }
      }),
    );
    httpRequests += partial.reduce((a, b) => a + b, 0);
  }

  const stats: SiteHostScrapeStats = {
    hostsAttempted: targets.length,
    hostsWithEmail: Object.keys(siteHostEmails).length,
    httpRequests,
  };

  return { siteHostEmails, stats };
}
