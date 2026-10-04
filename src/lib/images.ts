/** Best-effort og:image lookup for a vendor website. Never throws. */
export async function fetchOgImage(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith("http") || /instagram\.com/.test(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; SnorlaxBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const match =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (!match) return null;
    return new URL(match[1].replace(/&amp;/g, "&"), url).toString();
  } catch {
    return null;
  }
}
