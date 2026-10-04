import { listReceived, getMessage, replyToMessage, sendMessage } from "./agentmail";
import { describeRequirements, getCategory } from "./categories";
import { coupleProse, counterTarget, draftCounter, draftQuoteRequest, extractQuote } from "./emails";
import { env } from "./env";
import { enrichVendor, researchVendors } from "./exa";
import { fetchOgImage } from "./images";
import { formatMoney } from "./format";
import { llmName } from "./llm";
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
    if (!found.length) throw new Error("No vendors found for this city. Try loosening the requirements a bit.");
    await log("research", `Reviewed ${found.length} candidates: ${found.map((v) => v.name).join(", ")}`);

    // 2. Shortlist
    const picked = pickShortlist(found, req.budget, 3);
    await log("shortlist", `Pulling portfolios and contact details for ${picked.map((v) => v.name).join(", ")}…`);
    const enriched = await Promise.all(
      picked.map(async (v) => {
        const e = await enrichVendor(v, { city: wedding.city, vendorNoun: category.vendorNoun });
        if (!e.images.length) {
          const og = await fetchOgImage(e.website);
          if (og) e.images = [og];
        }
        return e;
      }),
    );
    const saved = [];
    for (const v of found) {
      const i = picked.indexOf(v);
      const row = i >= 0 ? enriched[i] : v;
      const inserted = await repo.insertVendor(requestId, row, scoreVendor(row, req.budget), i >= 0);
      if (i >= 0) saved.push(inserted);
    }
    saved.sort((a, b) => b.score - a.score);
    await repo.setRequestStatus(requestId, "shortlisted");
    await log(
      "shortlist",
      `Shortlisted ${saved.map((v) => `${v.name} (${v.score})`).join(", ")} on rating, reviews, budget fit and portfolio`,
    );

    // 3. Outreach. Demo mode routes every email to the team inboxes instead of real vendors.
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
        ? `${draft.text}\n\n---\nDemo note: this email was meant for ${v.name}${v.email ? ` (${v.email})` : ""}. Reply as the vendor with a price to test the negotiation.`
        : draft.text;
      // Demo inboxes receive every vendor's email; tag the subject so each lands in its own Gmail thread.
      const subject = demo.length ? `[${v.name}] ${draft.subject}` : draft.subject;
      try {
        const res = await sendMessage(to, subject, text);
        await repo.markContacted(v.id, to, res.thread_id);
        await repo.insertMessage(v.id, "out", res.message_id, subject, text);
        sent++;
        await log("outreach", `Emailed ${v.name} (${draft.usedLlm ? `written by ${llmName()}` : "template"}) → ${to}`);
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
      await log(`${vendor.name} replied. Reading their quote…`);

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
            couple: coupleProse(wedding),
            quotePrice: quote.price,
            counterPrice: target,
            currency,
            quote,
          });
          const sent = await replyToMessage(m.message_id, draft.text);
          await repo.insertMessage(vendor.id, "out", sent.message_id, `Re: ${full.subject ?? ""}`, draft.text);
          await repo.setVendorQuote(vendor.id, "countered", { ...quote, counter_price: target });
          await log(`Countered ${vendor.name} at ${formatMoney(target, currency)} (${draft.usedLlm ? llmName() : "template"})`);
        } else {
          await log(`${vendor.name}'s quote is already well within budget, so no counter needed`);
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

// The poller lives on globalThis, so after a dev hot reload it would keep calling the previous
// module's functions. Replace it so it always runs the current code.
if (state.poller) {
  clearInterval(state.poller);
  state.poller = undefined;
  ensureReplyPoller();
}
