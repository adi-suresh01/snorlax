import "dotenv/config";
import { enrichVendor } from "../src/lib/exa";
import type { ResearchedVendor } from "../src/lib/types";

// Dev check: run Exa enrichment on a few vendor names without touching the DB or sending email.
const names = process.argv.slice(2).length ? process.argv.slice(2) : ["WedClick", "Just Candid", "Ganesh Digital Studio"];
const blank = (name: string): ResearchedVendor => ({
  name, website: null, instagram: null, email: null, phone: null, location: null, price_estimate: null, price_low: null,
  rating: null, review_count: null, review_summary: null, style: null, images: [], fit_notes: null, sources: [],
});

(async () => {
  const t = Date.now();
  const out = await Promise.all(names.map((n) => enrichVendor(blank(n), { city: "Udaipur", vendorNoun: "wedding photographer" })));
  for (const v of out) {
    console.log(`${v.name}: ${v.images.length} images, web=${v.website} ig=${v.instagram} email=${v.email} phone=${v.phone}`);
    console.log(`   ${v.images.slice(0, 2).join("\n   ")}`);
  }
  console.log(`${Date.now() - t}ms`);
})();
