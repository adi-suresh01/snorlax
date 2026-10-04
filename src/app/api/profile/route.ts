import { NextResponse } from "next/server";
import { HttpError, handle, requireApiSession } from "@/lib/api";
import { getWeddingByUser, upsertWedding } from "@/lib/repo";
import type { WeddingEvent } from "@/lib/types";

export const GET = handle(async () => {
  const session = await requireApiSession();
  return NextResponse.json({ wedding: await getWeddingByUser(session.userId) });
});

export const PUT = handle(async (req: Request) => {
  const session = await requireApiSession();
  const body = await req.json();
  const events: WeddingEvent[] = (Array.isArray(body.events) ? body.events : [])
    .map((e: Partial<WeddingEvent>) => ({
      name: String(e.name || "").trim(),
      date: String(e.date || ""),
      venue: String(e.venue || "").trim(),
      guests: Math.max(0, Number(e.guests) || 0),
    }))
    .filter((e: WeddingEvent) => e.name);
  const partner1 = String(body.partner1 || "").trim();
  const partner2 = String(body.partner2 || "").trim();
  const city = String(body.city || "").trim();
  if (!partner1 || !partner2) throw new HttpError(400, "Both names are required");
  if (!city) throw new HttpError(400, "City is required");
  if (!events.length) throw new HttpError(400, "Add at least one event");

  const wedding = await upsertWedding(session.userId, {
    partner1,
    partner2,
    city,
    currency: "USD",
    events,
    notes: String(body.notes || "").trim(),
  });
  return NextResponse.json({ wedding });
});
