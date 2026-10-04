import { env } from "./env";
import { stripDashes } from "./format";
import type { ResearchedVendor, Source } from "./types";

const EXA = "https://api.exa.ai";
const AGENT_TIMEOUT_MS = Number(process.env.EXA_AGENT_TIMEOUT_MS || 180_000);

export type ResearchContext = {
  vendorNoun: string;
  categoryLabel: string;
  city: string;
  dates: string[];
  requirementLines: string[];
  budget: number | null;
  currency: string;
};

type RawVendor = {
  name?: string;
  website?: string;
  instagram?: string;
  email?: string;
  phone?: string;
  location?: string;
  price_estimate?: string;
  starting_price?: number;
  rating?: number;
  review_count?: number;
  review_summary?: string;
  style?: string;
  portfolio_image_urls?: string[];
  fit_notes?: string;
  source_urls?: string[];
};

const vendorSchema = {
  type: "object",
  properties: {
    vendors: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          website: { type: "string", format: "uri" },
          instagram: { type: "string", description: "Instagram profile URL or @handle" },
          email: { type: "string", format: "email" },
          phone: { type: "string", format: "phone" },
          location: { type: "string" },
          price_estimate: { type: "string", description: "Published or reported pricing in plain words, e.g. 'Packages from $3,500 to $6,000'" },
          starting_price: { type: "number", description: "Lowest package price in US dollars as a plain number" },
          rating: { type: "number", description: "Average review rating out of 5" },
          review_count: { type: "integer" },
          review_summary: { type: "string", description: "What reviewers praise or criticise, 1-2 sentences" },
          style: { type: "string" },
          portfolio_image_urls: {
            type: "array",
            maxItems: 4,
            items: { type: "string", format: "uri" },
            description: "Direct image URLs (jpg/png/webp) from their portfolio or listing",
          },
          fit_notes: { type: "string", description: "Why this vendor fits the couple's requirements, 1 sentence" },
          source_urls: { type: "array", maxItems: 4, items: { type: "string", format: "uri" } },
        },
        required: ["name"],
      },
    },
  },
  required: ["vendors"],
};

function headers() {
  return { "content-type": "application/json", "x-api-key": env.exaApiKey };
}

function buildTask(ctx: ResearchContext): string {
  const when = ctx.dates.filter(Boolean).length ? ` on ${ctx.dates.filter(Boolean).join(", ")}` : "";
  const budget = ctx.budget ? ` Budget is around ${ctx.budget} ${ctx.currency}.` : "";
  const needs = ctx.requirementLines.length ? ` Requirements: ${ctx.requirementLines.join("; ")}.` : "";
  return (
    `Find the best ${ctx.vendorNoun}s that serve ${ctx.city} for a wedding${when}.${needs}${budget} ` +
    `Compare many options using reviews (The Knot, WeddingWire, Zola, Google, Yelp), their Instagram portfolios and their websites. ` +
    `Prefer well-reviewed vendors with active portfolios whose pricing fits the budget. For each, capture contact details and pricing.`
  );
}

const systemPrompt =
  "Only include real, currently operating vendors that serve the stated city. Never invent contact details, ratings or prices: leave a field out when it cannot be verified from a page. Deduplicate vendors that appear on multiple directories.";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
/** Free text shown to users: same as str, minus em/en dashes. */
const prose = (v: unknown) => {
  const s = str(v);
  return s ? stripDashes(s) : null;
};
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "Double Knot Pictures | Photo + Video" → "Double Knot Pictures". Hyphenated words stay intact. */
export function cleanVendorName(name: string): string {
  const head = name.split(/\s+[|•·–—-]\s+/)[0].trim();
  return head || name.trim();
}

/** Page titles for source links: single line, no em/en dashes. */
export function cleanTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;
  return stripDashes(title.replace(/\s+/g, " ").trim()).replace(/^,\s*/, "");
}

function normalizeInstagram(v: string | null): string | null {
  if (!v) return null;
  if (v.startsWith("http")) return v;
  const handle = v.replace(/^@/, "").trim();
  return handle ? `https://instagram.com/${handle}` : null;
}

export function toResearchedVendor(raw: RawVendor, fallbackSources: Source[]): ResearchedVendor | null {
  const rawName = str(raw.name);
  const name = rawName ? cleanVendorName(rawName) : null;
  if (!name) return null;
  const sources = (raw.source_urls || []).filter((u) => typeof u === "string").map((url) => ({ url }));
  return {
    name,
    website: str(raw.website),
    instagram: normalizeInstagram(str(raw.instagram)),
    email: str(raw.email),
    phone: str(raw.phone),
    location: prose(raw.location),
    price_estimate: prose(raw.price_estimate),
    price_low: num(raw.starting_price),
    rating: num(raw.rating),
    review_count: num(raw.review_count),
    review_summary: prose(raw.review_summary),
    style: prose(raw.style),
    images: (raw.portfolio_image_urls || []).filter((u) => typeof u === "string" && u.startsWith("http")),
    fit_notes: prose(raw.fit_notes),
    sources: sources.length ? sources : fallbackSources.slice(0, 3),
  };
}

/** Collect every {url,title} pair anywhere inside a grounding / citations payload. */
function collectSources(node: unknown, out: Source[] = []): Source[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => collectSources(n, out));
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.url === "string" && !out.some((s) => s.url === obj.url)) {
    out.push({ url: obj.url, title: typeof obj.title === "string" ? cleanTitle(obj.title) : undefined });
  }
  Object.values(obj).forEach((v) => collectSources(v, out));
  return out;
}

function parseVendors(structured: unknown, grounding: unknown): ResearchedVendor[] {
  const list = (structured as { vendors?: RawVendor[] } | null)?.vendors;
  if (!Array.isArray(list)) return [];
  const sources = collectSources(grounding);
  return list.map((v) => toResearchedVendor(v, sources)).filter((v): v is ResearchedVendor => v !== null);
}

async function agentResearch(ctx: ResearchContext, log: (m: string) => Promise<void>): Promise<ResearchedVendor[]> {
  const res = await fetch(`${EXA}/agent/runs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      query: `${buildTask(ctx)}\n\n${systemPrompt}`,
      effort: process.env.EXA_AGENT_EFFORT || "low",
      outputSchema: vendorSchema,
    }),
  });
  if (!res.ok) throw new Error(`Exa agent create HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const run = await res.json();
  const id: string = run.id;
  await log(`Exa research agent started (${id})`);

  const deadline = Date.now() + AGENT_TIMEOUT_MS;
  let lastStatus = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const poll = await fetch(`${EXA}/agent/runs/${id}`, { headers: headers() });
    if (!poll.ok) continue;
    const data = await poll.json();
    if (data.status !== lastStatus) {
      lastStatus = data.status;
      await log(`Exa agent status: ${data.status}`);
    }
    if (data.status === "completed") {
      return parseVendors(data.output?.structured, data.output?.grounding);
    }
    if (data.status === "failed" || data.status === "cancelled") {
      throw new Error(`Exa agent ${data.status}: ${JSON.stringify(data.error ?? data.stopReason ?? "").slice(0, 200)}`);
    }
  }
  fetch(`${EXA}/agent/runs/${id}/cancel`, { method: "POST", headers: headers() }).catch(() => {});
  throw new Error("Exa agent timed out");
}

async function searchResearch(ctx: ResearchContext, type: "deep" | "auto"): Promise<ResearchedVendor[]> {
  const when = ctx.dates.filter(Boolean).length ? ` for a wedding on ${ctx.dates.filter(Boolean)[0]}` : "";
  const res = await fetch(`${EXA}/search`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(150_000),
    body: JSON.stringify({
      query: `best ${ctx.vendorNoun}s in ${ctx.city}${when} with reviews, pricing and Instagram portfolio`,
      type,
      systemPrompt: `${systemPrompt} The couple needs: ${ctx.requirementLines.join("; ") || "standard package"}.${ctx.budget ? ` Budget around ${ctx.budget} ${ctx.currency}.` : ""}`,
      outputSchema: vendorSchema,
      contents: { highlights: true },
    }),
  });
  if (!res.ok) throw new Error(`Exa search HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const structured = data.output?.content ?? data.output?.structured ?? data.output;
  const parsed = typeof structured === "string" ? JSON.parse(structured) : structured;
  const fallback = (data.results || []).map((r: { url: string; title?: string }) => ({ url: r.url, title: cleanTitle(r.title) }));
  const vendors = parseVendors(parsed, data.output?.grounding);
  return vendors.map((v) => (v.sources.length ? v : { ...v, sources: fallback.slice(0, 3) }));
}

const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|$)/i;
const NOT_PORTFOLIO = /(icon|logo|avatar|sprite|placeholder|banner-ad|question|vector|badge|\/20X\/|\/50X\/|\.svg)/i;
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length >= 4);

/** Keep real photos, upsize known CDN thumbnails, dedupe by filename. */
export function pickPortfolioImages(urls: string[], max = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (!raw || !raw.startsWith("http") || !IMAGE_EXT.test(raw) || NOT_PORTFOLIO.test(raw)) continue;
    const url = raw.replace(/\/resized\/\d+X\//, "/resized/800X/");
    // WordPress serves resized copies as name-683x1024.jpg; treat them as the same photo.
    const file = (url.split("?")[0].split("/").pop() ?? url).replace(/-\d+x\d+(?=\.\w+$)/, "");
    if (seen.has(file)) continue;
    seen.add(file);
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}

type ExaResult = { url: string; title?: string; image?: string; extras?: { imageLinks?: string[] } };

/**
 * One focused search per shortlisted vendor: portfolio photos via `extras.imageLinks`
 * and missing contact fields via a compact `outputSchema`. Never throws; returns the vendor unchanged on failure.
 */
export async function enrichVendor(v: ResearchedVendor, ctx: { city: string; vendorNoun: string }): Promise<ResearchedVendor> {
  try {
    const res = await fetch(`${EXA}/search`, {
      method: "POST",
      headers: headers(),
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        query: `${v.name} ${ctx.vendorNoun} ${ctx.city} portfolio`,
        numResults: 5,
        systemPrompt: `Only report contact details that belong to ${v.name} in ${ctx.city} itself, never a directory, marketplace or a different business. Leave a field out when it cannot be verified.`,
        outputSchema: {
          type: "object",
          properties: {
            website: { type: "string", format: "uri" },
            instagram: { type: "string", description: "Instagram profile URL or @handle of this vendor" },
            email: { type: "string", format: "email" },
            phone: { type: "string", format: "phone" },
          },
        },
        contents: { highlights: true, extras: { imageLinks: 8 } },
      }),
    });
    if (!res.ok) return v;
    const data = await res.json();
    const results: ExaResult[] = data.results || [];
    const nameTokens = tokens(v.name);
    const aboutVendor = (r: ExaResult) => {
      const hay = `${r.title ?? ""} ${r.url}`.toLowerCase().replace(/[^a-z0-9]/g, "");
      return nameTokens.some((t) => hay.includes(t));
    };
    const relevant = results.filter(aboutVendor);
    const images = pickPortfolioImages([
      ...v.images,
      ...relevant.flatMap((r) => [r.image ?? "", ...(r.extras?.imageLinks ?? [])]),
    ]);

    const raw = data.output?.content ?? data.output?.structured;
    const found = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<Record<"website" | "instagram" | "email" | "phone", string>> | null;
    const sources = [...v.sources];
    for (const r of relevant.slice(0, 3)) if (!sources.some((s) => s.url === r.url)) sources.push({ url: r.url, title: cleanTitle(r.title) });

    return {
      ...v,
      images,
      website: v.website ?? str(found?.website),
      instagram: v.instagram ?? normalizeInstagram(str(found?.instagram)),
      email: v.email ?? str(found?.email),
      phone: v.phone ?? str(found?.phone),
      sources,
    };
  } catch {
    return v;
  }
}

/** Agent API first (deep, multi-source research); fall back to deep search, then auto search. */
export async function researchVendors(
  ctx: ResearchContext,
  log: (m: string) => Promise<void> = async () => {},
): Promise<ResearchedVendor[]> {
  const mode = process.env.EXA_RESEARCH_MODE || "agent";
  if (mode === "agent") {
    try {
      const vendors = await agentResearch(ctx, log);
      if (vendors.length) return vendors;
      await log("Exa agent returned no vendors, falling back to deep search");
    } catch (err) {
      await log(`Exa agent unavailable (${(err as Error).message}); falling back to deep search`);
    }
  }
  try {
    const vendors = await searchResearch(ctx, "deep");
    if (vendors.length) return vendors;
  } catch (err) {
    await log(`Exa deep search failed (${(err as Error).message}); trying auto search`);
  }
  return searchResearch(ctx, "auto");
}
