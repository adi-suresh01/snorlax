import { NextResponse } from "next/server";
import { handle, requireApiWedding } from "@/lib/api";
import { isRunning } from "@/lib/pipeline";
import { listRequests, listVendors } from "@/lib/repo";

/** Dashboard summary: status + shortlist size + best quote per category. */
export const GET = handle(async () => {
  const { wedding } = await requireApiWedding();
  const requests = await listRequests(wedding.id);
  const summary = await Promise.all(
    requests.map(async (r) => {
      const vendors = (await listVendors(r.id)).filter((v) => v.shortlisted);
      const prices = vendors.map((v) => v.quote?.counter_price ?? v.quote?.price).filter((p): p is number => !!p);
      return {
        category: r.category,
        status: r.status,
        budget: r.budget,
        running: isRunning(r.id),
        shortlisted: vendors.map((v) => ({ name: v.name, image: v.images[0] ?? null, status: v.status })),
        bestQuote: prices.length ? Math.min(...prices) : null,
        lastEvent: r.progress[r.progress.length - 1]?.message ?? null,
      };
    }),
  );
  return NextResponse.json({ wedding, summary });
});
