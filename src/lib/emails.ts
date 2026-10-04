import { describeRequirements, type CategoryConfig } from "./categories";
import { chatJSON, chatText } from "./llm";
import { formatMoney, roundNice } from "./money";
import type { Quote, Requirements, Wedding } from "./types";

export const ANCHOR_RATIO = 0.85;
export const COUNTER_RATIO = 0.88;

export type QuoteRequestInput = {
  wedding: Wedding;
  category: CategoryConfig;
  requirements: Requirements;
  budget: number | null;
  vendorName: string;
  /** What research said about this vendor; used to personalise the opener. */
  vendorNotes?: string | null;
};

export const coupleName = (w: Wedding) => [w.partner1, w.partner2].filter(Boolean).join(" & ");

export function quoteSubject(input: QuoteRequestInput): string {
  return `Quote request: ${input.category.label} for ${coupleName(input.wedding)}'s wedding — ${input.vendorName}`;
}

/** The factual block every quote request carries, regardless of who wrote the opener. */
export function detailsBlock({ wedding, category, requirements, budget }: QuoteRequestInput): string {
  const events = wedding.events
    .map((e) => `  • ${e.name} — ${e.date || "date TBC"} at ${e.venue || "venue TBC"} (${e.guests} guests)`)
    .join("\n");
  const reqs = describeRequirements(category, requirements)
    .map((l) => `  • ${l}`)
    .join("\n");
  const anchor = budget ? roundNice(budget * ANCHOR_RATIO) : null;

  return [
    `Couple: ${coupleName(wedding)}`,
    `City: ${wedding.city}`,
    `Events:\n${events || "  • Dates to be confirmed"}`,
    `What we need (${category.label}):\n${reqs || "  • Open to your recommended package"}`,
    anchor ? `Budget: we're planning around ${formatMoney(anchor, wedding.currency)} for this.` : null,
    wedding.notes ? `Other notes: ${wedding.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const ASKS = `Could you please share:
  1. An itemized quote for the above
  2. Your availability on these dates
  3. What's included (hours, deliverables, travel, taxes)
  4. A few links to similar weddings you've done`;

const signOff = (w: Wedding) => `Warmly,\nSnorlax — wedding planning assistant for ${coupleName(w)}`;

function assemble(input: QuoteRequestInput, opener: string): string {
  return [`Hi ${input.vendorName} team,`, opener, `Here are the details:`, detailsBlock(input), ASKS, signOff(input.wedding)].join(
    "\n\n",
  );
}

export function templateQuoteRequest(input: QuoteRequestInput): { subject: string; text: string } {
  const opener = `I'm helping ${coupleName(input.wedding)} plan their wedding in ${input.wedding.city}, and your work stood out while we were shortlisting ${input.category.vendorNoun}s. We'd love a quote.`;
  return { subject: quoteSubject(input), text: assemble(input, opener) };
}

/** LLM writes a personalised opener; the facts block is always deterministic. Falls back to the template. */
export async function draftQuoteRequest(input: QuoteRequestInput): Promise<{ subject: string; text: string; usedLlm: boolean }> {
  try {
    const opener = await chatText(
      "You write short, warm, professional outreach emails for a wedding planner. Output only the paragraph, no greeting, no sign-off, no placeholders.",
      `Write a 2-3 sentence opening paragraph to ${input.vendorName}, a ${input.category.vendorNoun}, asking for a quote for ${coupleName(input.wedding)}'s wedding in ${input.wedding.city}. ` +
        (input.vendorNotes ? `Mention specifically what we liked about them: ${input.vendorNotes}. ` : "") +
        `Do not mention prices or dates; those follow in a details section.`,
      { maxTokens: 220, timeoutMs: 60_000 },
    );
    const clean = opener.replace(/^["']|["']$/g, "").trim();
    if (clean.length < 40 || /\[.*?\]/.test(clean)) throw new Error("weak opener");
    return { subject: quoteSubject(input), text: assemble(input, clean), usedLlm: true };
  } catch {
    return { ...templateQuoteRequest(input), usedLlm: false };
  }
}

export function counterTarget(quotePrice: number, budget: number | null): number {
  const target = quotePrice * COUNTER_RATIO;
  return roundNice(budget ? Math.min(target, budget) : target);
}

export type CounterInput = {
  vendorName: string;
  couple: string;
  quotePrice: number;
  counterPrice: number;
  currency: string;
};

export function templateCounter(c: CounterInput): string {
  return [
    `Hi ${c.vendorName} team,`,
    `Thank you so much for the detailed quote of ${formatMoney(c.quotePrice, c.currency)} — ${c.couple} really liked your work.`,
    `We're comparing a few shortlisted options at the moment, and to make this work within their budget we'd like to propose ${formatMoney(c.counterPrice, c.currency)} for the same scope. If that's not possible, could you suggest which inclusions could be adjusted to get closer to that number?`,
    `If we can agree on this, ${c.couple} are ready to move quickly to confirm the dates.`,
    `Warmly,\nSnorlax — wedding planning assistant for ${c.couple}`,
  ].join("\n\n");
}

export async function draftCounter(c: CounterInput & { quote: Quote }): Promise<{ text: string; usedLlm: boolean }> {
  try {
    const text = await chatText(
      "You are a polite but firm wedding-planning negotiator writing an email reply. Output only the email body, starting with a greeting and ending with the sign-off 'Warmly,\\nSnorlax — wedding planning assistant for <couple>'. No placeholders.",
      `Vendor: ${c.vendorName}\nCouple: ${c.couple}\nTheir quote: ${formatMoney(c.quotePrice, c.currency)}\nInclusions they listed: ${c.quote.inclusions.join("; ") || "not specified"}\nAvailability: ${c.quote.availability || "not stated"}\n\n` +
        `Write a short reply (under 150 words) that thanks them, says we're comparing a few shortlisted vendors, and proposes exactly ${formatMoney(c.counterPrice, c.currency)} for the same scope. Offer flexibility on inclusions if they can't match. Say the couple can confirm quickly if agreed.`,
      { maxTokens: 350, timeoutMs: 75_000 },
    );
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits.includes(String(c.counterPrice)) || /\[.*?\]/.test(text)) throw new Error("counter price missing");
    return { text, usedLlm: true };
  } catch {
    return { text: templateCounter(c), usedLlm: false };
  }
}

/** Pull the first money-looking number out of an email: handles ₹3,00,000 / $4,500 / 3.5 lakh / 4k. */
export function regexPrice(text: string): number | null {
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|L)\b/i);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  const money = text.match(/(?:₹|rs\.?|inr|\$|usd)\s*([\d,]+(?:\.\d+)?)\s*(k)?/i);
  if (money) {
    const n = parseFloat(money[1].replace(/,/g, ""));
    return Math.round(money[2] ? n * 1000 : n);
  }
  return null;
}

export async function extractQuote(emailText: string, defaultCurrency: string): Promise<Quote> {
  try {
    const q = await chatJSON<Partial<Quote>>(
      "You extract structured quote data from vendor emails. Reply ONLY with JSON.",
      `Email from a wedding vendor:\n"""\n${emailText.slice(0, 4000)}\n"""\n\n` +
        `Return {"price": number|null (the total price they are offering now, as a plain number, convert lakh to full number), "currency": string|null (ISO code), "inclusions": string[], "availability": string|null, "notes": string|null (one sentence summary of anything else important)}`,
      { maxTokens: 400, timeoutMs: 75_000 },
    );
    return {
      price: typeof q.price === "number" && q.price > 0 ? q.price : regexPrice(emailText),
      currency: q.currency || defaultCurrency,
      inclusions: Array.isArray(q.inclusions) ? q.inclusions.map(String) : [],
      availability: q.availability ?? null,
      notes: q.notes ?? null,
    };
  } catch {
    return { price: regexPrice(emailText), currency: defaultCurrency, inclusions: [], availability: null, notes: null };
  }
}
