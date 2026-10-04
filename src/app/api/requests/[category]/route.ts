import { NextResponse } from "next/server";
import { HttpError, handle, requireApiWedding } from "@/lib/api";
import { getCategory } from "@/lib/categories";
import { ensureReplyPoller, isRunning, startCategoryPipeline } from "@/lib/pipeline";
import { getRequest, listMessagesForRequest, listVendors, saveRequirements } from "@/lib/repo";
import type { Requirements } from "@/lib/types";

type Ctx = { params: Promise<{ category: string }> };

async function resolveCategory(ctx: Ctx) {
  const { category } = await ctx.params;
  const config = getCategory(category);
  if (!config) throw new HttpError(404, "Unknown category");
  return config;
}

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const category = await resolveCategory(ctx);
  const { wedding } = await requireApiWedding();
  const request = await getRequest(wedding.id, category.slug);
  if (!request) return NextResponse.json({ request: null, vendors: [], messages: [], running: false });
  if (["outreach_sent", "quotes_in"].includes(request.status)) ensureReplyPoller();
  const [vendors, messages] = await Promise.all([listVendors(request.id), listMessagesForRequest(request.id)]);
  return NextResponse.json({ request, vendors, messages, running: isRunning(request.id) });
});

/** Save requirements + budget; with `start: true` also kicks off the agent pipeline. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const category = await resolveCategory(ctx);
  const { wedding } = await requireApiWedding();
  const body = await req.json();
  const budget = Number(body.budget) > 0 ? Number(body.budget) : null;
  if (body.start && !budget) throw new HttpError(400, "Set a budget for this category first");

  const requirements: Requirements = typeof body.requirements === "object" && body.requirements ? body.requirements : {};
  const request = await saveRequirements(wedding.id, category.slug, requirements, budget);
  const started = body.start ? startCategoryPipeline(request.id) : false;
  return NextResponse.json({ request, started });
});
