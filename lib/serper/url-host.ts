/** Host normalizado (sem www) para match de domínio / dedupe. */
export function leadSiteHostname(u?: string | null): string | null {
  if (!u?.trim()) return null;
  const t = u.trim();
  const withProto = t.startsWith("http://") || t.startsWith("https://") ? t : `https://${t}`;
  try {
    const h = new URL(withProto).hostname.toLowerCase().replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}
