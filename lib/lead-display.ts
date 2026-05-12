/** E-mail sintético gerado na importação web (dedupe por URL). */
const SYNTHETIC_IMPORT_EMAIL = /^web\+[a-f0-9]+@import\.invalid$/i;

export function isSyntheticWebImportEmail(email: string | undefined | null): boolean {
  if (!email?.trim()) return false;
  return SYNTHETIC_IMPORT_EMAIL.test(email.trim());
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
