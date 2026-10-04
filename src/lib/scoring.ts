import type { ResearchedVendor } from "./types";

/**
 * 0..100 score. Weights: rating 40, review volume 20, budget fit 25, completeness 15.
 * Unknown values get a neutral-ish share so missing data doesn't zero a good vendor.
 */
export function scoreVendor(v: ResearchedVendor, budget: number | null): number {
  const rating = v.rating != null ? Math.min(Math.max(v.rating, 0), 5) : 3.5;
  const ratingScore = (rating / 5) * 40;

  const reviewScore =
    v.review_count != null ? Math.min(Math.log10(v.review_count + 1) / Math.log10(500), 1) * 20 : 5;

  let budgetScore = 12.5;
  if (budget && v.price_low != null) {
    budgetScore = v.price_low <= budget ? 25 : Math.max(0, 25 * (1 - (v.price_low - budget) / budget));
  }

  const completeness =
    (v.email ? 5 : 0) + (v.phone ? 3 : 0) + (v.images.length ? 4 : 0) + (v.instagram || v.website ? 3 : 0);

  const total = ratingScore + reviewScore + budgetScore + completeness;
  return Math.round(Math.min(Math.max(total, 0), 100) * 10) / 10;
}

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export function pickShortlist<T extends ResearchedVendor>(vendors: T[], budget: number | null, n = 3): T[] {
  const seen = new Set<string>();
  return vendors
    .map((v) => ({ v, s: scoreVendor(v, budget) }))
    .sort((a, b) => b.s - a.s)
    .filter(({ v }) => {
      const key = normalize(v.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, n)
    .map(({ v }) => v);
}
