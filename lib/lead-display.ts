const EMAIL_REGEX = /[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}/g;

const NOISE_EMAIL_SUBSTRINGS = [
  "noreply",
  "no-reply",
  "donotreply",
  "mailer-daemon",
  "postmaster",
  "example.com",
  "test@",
  "schema.org",
];

/** E-mail sintético gerado na importação web (dedupe por URL). */
const SYNTHETIC_IMPORT_EMAIL = /^web\+[a-f0-9]+@import\.invalid$/i;

export function isSyntheticWebImportEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  return SYNTHETIC_IMPORT_EMAIL.test(email.trim());
}

const SENDABLE_EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E-mail utilizável para disparo (API Resend): não vazio, não placeholder (“—”),
 * não sintético de importação web, formato mínimo `local@domínio`.
 */
export function hasSendableLeadEmail(email: string | null | undefined): boolean {
  if (isSyntheticWebImportEmail(email)) return false;
  const t = (email ?? "").trim();
  if (!t || t === "—" || t === "-" || t.toLowerCase() === "null") return false;
  return SENDABLE_EMAIL_SHAPE.test(t);
}

/** Texto na célula: e-mail real ou traço (importação web usa e-mail interno). */
export function formatLeadEmailForTable(email: string | undefined | null): string {
  const raw = email?.trim();
  if (!raw || raw.toLowerCase() === "null") return "—";
  if (isSyntheticWebImportEmail(raw)) return "—";
  if (raw.length > 42) return `${raw.slice(0, 40)}…`;
  return raw;
}

export function formatLeadPhoneForTable(phone: string | undefined | null): string {
  const t = phone?.trim();
  if (!t || t === "—" || t.toLowerCase() === "null") return "—";
  if (t.length > 22) return `${t.slice(0, 10)}…${t.slice(-6)}`;
  return t;
}

/** Tenta obter telefone a partir do texto do snippet (ex.: resultados do Maps). */
export function extractPhoneFromSnippet(text: string | undefined | null): string | undefined {
  if (!text?.trim()) return undefined;
  const m = text.match(/\+?\d[\d\s().-]{8,}\d/);
  if (!m) return undefined;
  const cleaned = m[0].replace(/\s+/g, " ").trim();
  return cleaned.length >= 10 ? cleaned.slice(0, 42) : undefined;
}

/** E-mails encontrados no texto (ordem de aparição, sem duplicar case-insensitive). */
export function extractEmailsFromText(text: string | undefined | null): string[] {
  if (!text?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const matches = text.matchAll(EMAIL_REGEX);
  for (const m of matches) {
    const raw = m[0].replace(/\.$/, "").trim();
    if (!raw.includes("@")) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw.slice(0, 320));
  }
  return out;
}

export function isLikelyContactEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (isSyntheticWebImportEmail(lower)) return false;
  if (NOISE_EMAIL_SUBSTRINGS.some((s) => lower.includes(s))) return false;
  const local = lower.split("@")[0] ?? "";
  if (local.length < 2) return false;
  return true;
}

const MAPS_OR_GOOGLE_HOST =
  /google\.[a-z.]+\/(maps|search)|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i;

/**
 * URL https do site do lead para abrir no navegador.
 * Ignora `webSourceUrl` que seja só ficha do Google Maps (importação sem site próprio).
 */
export function leadWebUrlFromStoredSource(
  webSourceUrl: string | null | undefined,
  fallbackUrl?: string | null,
): string | undefined {
  for (const raw of [fallbackUrl, webSourceUrl]) {
    if (!raw?.trim()) continue;
    const w = raw.trim();
    if (MAPS_OR_GOOGLE_HOST.test(w)) continue;
    try {
      const href = w.startsWith("http://") || w.startsWith("https://") ? w : `https://${w}`;
      const u = new URL(href);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (MAPS_OR_GOOGLE_HOST.test(u.href)) continue;
      return u.href;
    } catch {
      continue;
    }
  }
  return undefined;
}
