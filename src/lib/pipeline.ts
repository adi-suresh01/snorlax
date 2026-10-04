import { listReceived, getMessage, replyToMessage, sendMessage } from "./agentmail";
import { describeRequirements, getCategory } from "./categories";
import { coupleName, counterTarget, draftCounter, draftQuoteRequest, extractQuote } from "./emails";
import { env } from "./env";
import { researchVendors } from "./exa";
import { fetchOgImage } from "./images";
import { formatMoney } from "./money";
import * as repo from "./repo";
import { pickShortlist, scoreVendor } from "./scoring";

type PipelineGlobals = { running: Set<string>; polling: boolean; poller?: ReturnType<typeof setInterval> };
// Survive Next dev hot reloads.
const g = globalThis as typeof globalThis & { __snorlax?: PipelineGlobals };
const state: PipelineGlobals = (g.__snorlax ??= { running: new Set(), polling: false });

export function isRunning(requestId: string) {
  return state.running.has(requestId);
}

/** Fire-and-forget: research → shortlist → outreach. Progress is written to the DB for the UI. */
export function startCategoryPipeline(requestId: string): boolean {
  if (state.running.has(requestId)) return false;
  state.running.add(requestId);
  runPipeline(requestId)
    .catch((err) => console.error("pipeline crashed", err))
    .finally(() => state.running.delete(requestId));
  return true;
}

async function runPipeline(requestId: string) {
  const req = await repo.getRequestById(requestId);
  if (!req) throw new Error(`request ${requestId} not found`);
  const wedding = await repo.getWeddingById(req.wedding_id);
  const category = getCategory(req.category);
  if (!wedding || !category) throw new Error("wedding or category missing");
  const log = (step: string, message: string) => repo.appendProgress(requestId, step, message);

  try {
    await repo.resetRequest(requestId);
    const requirementLines = describeRequirements(category, req.requirements);

    // 1. Research
    await log("research", `Searching the web for ${category.vendorNoun}s in ${wedding.city}…`);
    const found = await researchVendors(
      {
        vendorNoun: category.vendorNoun,
        categoryLabel: category.label,
        city: wedding.city,
        dates: wedding.events.map((e) => e.date),
        requirementLines,
        budget: req.budget,
        currency: wedding.currency,
      },
      (m) => log("research", m),
    );
    if (!found.length) throw new Error("No vendors found for this city — try broadening the requirements");
    await log("research", `Reviewed ${found.length} candidates: ${found.map((v) => v.name).join(", ")}`);

    // 2. Shortlist
    const shortlist = pickShortlist(found, req.budget, 3);
    await Promise.all(
      shortlist.map(async (v) => {
        if (v.images.length) return;
        const og = await fetchOgImage(v.website);
        if (og) v.images = [og];
      }),
    );
    const saved = [];
    for (const v of found) {
      const isShort = shortlist.includes(v);
      const row = await repo.insertVendor(requestId, v, scoreVendor(v, req.budget), isShort);
      if (isShort) saved.push(row);
    }
    await repo.setRequestStatus(requestId, "shortlisted");
    await log(
      "shortlist",
      `Shortlisted ${saved.map((v) => `${v.name} (${v.score})`).join(", ")} on rating, reviews, budget fit and portfolio`,
    );

    // 3. Outreach — demo mode routes every email to the team's inboxes.
    const demo = env.demoVendorEmails;
    let sent = 0;
    for (const [i, v] of saved.entries()) {
      const to = demo.length ? demo[i % demo.length] : v.email;
      if (!to) {
        await log("outreach", `No email found for ${v.name}; skipping`);
        continue;
      }
      await log("outreach", `Drafting a quote request for ${v.name}…`);
      const draft = await draftQuoteRequest({
        wedding,
        category,
        requirements: req.requirements,
        budget: req.budget,
        vendorName: v.name,
        vendorNotes: [v.style, v.review_summary].filter(Boolean).join(". ") || v.fit_notes,
      });
      const text = demo.length
        ? `${draft.text}\n\n—\n(Demo mode: this email was meant for ${v.name}${v.email ? ` <${v.email}>` : ""}. Reply as the vendor to test negotiation.)`
        : draft.text;
      try {
        const res = await sendMessage(to, draft.subject, text);
        await repo.markContacted(v.id, to, res.thread_id);
        await repo.insertMessage(v.id, "out", res.message_id, draft.subject, text);
        sent++;
        await log("outreach", `Emailed ${v.name} (${draft.usedLlm ? "written by Gemma" : "template"}) → ${to}`);
      } catch (err) {
        await repo.setVendorStatus(v.id, "send_failed");
        await log("outreach", `Could not email ${v.name}: ${(err as Error).message}`);
      }
    }
    if (!sent) throw new Error("No quote requests could be sent");
    await repo.setRequestStatus(requestId, "outreach_sent");
    await log("outreach", `Sent ${sent} quote request${sent > 1 ? "s" : ""}. Watching the inbox for replies…`);
    ensureReplyPoller();
  } catch (err) {
    const message = (err as Error).message;
    await repo.setRequestStatus(requestId, "error", message);
    await log("error", message);
  }
}

/** Process new inbound vendor emails: extract the quote, send one counter-offer. Returns messages handled. */
export async function checkReplies(): Promise<number> {
  if (state.polling) return 0;
  state.polling = true;
  let handled = 0;
  try {
    const messages = (await listReceived(50)).reverse(); // oldest first
    for (const m of messages) {
      if (await repo.messageExists(m.message_id)) continue;
      const vendor = await repo.findVendorByThread(m.thread_id);
      if (!vendor) continue;
      const req = await repo.getRequestById(vendor.request_id);
      const wedding = req && (await repo.getWeddingById(req.wedding_id));
      if (!req || !wedding) continue;
      const log = (message: string) => repo.appendProgress(req.id, "negotiation", message);

      const full = await getMessage(m.message_id);
      const body = (full.extracted_text || full.text || full.preview || "").trim();
      await repo.insertMessage(vendor.id, "in", m.message_id, full.subject ?? null, body);
      handled++;
      await log(`${vendor.name} replied — reading their quote…`);

      const quote = await extractQuote(body, wedding.currency);
      const currency = quote.currency || wedding.currency;
      const alreadyCountered = vendor.status === "countered";
      if (alreadyCountered && vendor.quote?.counter_price) quote.counter_price = vendor.quote.counter_price;
      await repo.setVendorQuote(vendor.id, alreadyCountered ? "countered" : "replied", quote);
      await log(
        quote.price
          ? `${vendor.name} quoted ${formatMoney(quote.price, currency)}${quote.inclusions.length ? ` (${quote.inclusions.slice(0, 3).join(", ")})` : ""}`
          : `${vendor.name} replied without a clear price`,
      );

      if (!alreadyCountered && quote.price) {
        const target = counterTarget(quote.price, req.budget);
        if (target < quote.price) {
          const draft = await draftCounter({
            vendorName: vendor.name,
            couple: coupleName(wedding),
            quotePrice: quote.price,
            counterPrice: target,
            currency,
            quote,
          });
          const sent = await replyToMessage(m.message_id, draft.text);
          await repo.insertMessage(vendor.id, "out", sent.message_id, `Re: ${full.subject ?? ""}`, draft.text);
          await repo.setVendorQuote(vendor.id, "countered", { ...quote, counter_price: target });
          await log(`Countered ${vendor.name} at ${formatMoney(target, currency)} (${draft.usedLlm ? "Gemma" : "template"})`);
        } else {
          await log(`${vendor.name}'s quote is already well within budget — no counter needed`);
        }
      }

      const vendors = await repo.listVendors(req.id);
      const anyCountered = vendors.some((v) => v.status === "countered");
      await repo.setRequestStatus(req.id, anyCountered ? "negotiated" : "quotes_in");
    }
  } finally {
    state.polling = false;
  }
  return handled;
}

/** Background inbox poll every 20s while any thread is waiting on a vendor. */
export function ensureReplyPoller() {
  if (state.poller) return;
  state.poller = setInterval(async () => {
    try {
      if (await repo.hasOpenThreads()) await checkReplies();
    } catch (err) {
      console.error("reply poll failed", (err as Error).message);
    }
  }, 20_000);
}
