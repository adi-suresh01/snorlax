export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString("en-US")}`;
  }
}

/** Round to a number a human would actually say in a negotiation. */
export function roundNice(n: number): number {
  if (n >= 100000) return Math.round(n / 1000) * 1000;
  if (n >= 10000) return Math.round(n / 500) * 500;
  if (n >= 1000) return Math.round(n / 50) * 50;
  return Math.round(n / 10) * 10;
}

/** "2026-10-17" → "Sat, Oct 17". Parsed as UTC so the day never shifts. */
export function formatEventDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Emails should read like a person wrote them: no em or en dashes. */
export function stripDashes(text: string): string {
  return text
    .replace(/(\$[\d,.]+[kK]?)\s*-\s*(\$\d)/g, "$1 to $2")
    .replace(/(\d[kK]?)\s*[–—]\s*(\$?\d)/g, "$1 to $2")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*–\s*/g, ", ")
    .replace(/[‐‑]/g, "-") // non-breaking/unicode hyphens some models emit
    .replace(/,\s*,/g, ",");
}
