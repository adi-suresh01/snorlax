import { describeRequirements, type CategoryConfig } from "./categories";
import { chatJSON, chatText } from "./llm";
import { formatEventDate, formatMoney, roundNice, stripDashes } from "./format";
import type { Quote, Requirements, Wedding } from "./types";

export const ANCHOR_RATIO = 0.85;
export const COUNTER_RATIO = 0.88;

export type QuoteRequestInput = {
  wedding: Wedding;
  category: CategoryConfig;
  requirements: Requirements;
  budget: number | null;
  vendorName: string;
  /** What research said about this vendor; used to personalize the opener. */
  vendorNotes?: string | null;
};

/** "Emma & James" for headings and subjects. */
export const coupleName = (w: Wedding) => [w.partner1, w.partner2].filter(Boolean).join(" & ");
/** "Emma and James" for sentences. */
export const coupleProse = (w: Wedding) => [w.partner1, w.partner2].filter(Boolean).join(" and ");

const signature = (couple: string) => `Snorlax\nPlanning assistant for ${couple}`;

/** The main day: the event with the most guests. */
function mainDate(w: Wedding): string | null {
  const main = [...w.events].sort((a, b) => b.guests - a.guests)[0];
  return main?.date ? formatEventDate(main.date) : null;
}

export function quoteSubject({ wedding, category }: QuoteRequestInput): string {
  const date = mainDate(wedding);
  return `Wedding ${category.label.toLowerCase()} inquiry for ${coupleName(wedding)}${date ? ` (${date})` : ""}`;
}

function eventLine(e: Wedding["events"][number]): string {
  const when = e.date ? ` on ${formatEventDate(e.date)}` : "";
  const where = e.venue ? ` at ${e.venue}` : "";
  return `- ${e.name}${when}${where} (${e.guests} guests)${e.date ? "" : ", date TBD"}`;
}

/** Everything the vendor needs to quote. Always deterministic, whoever writes the opener. */
export function detailsBlock({ wedding, category, requirements, budget }: QuoteRequestInput): string {
  const reqs = describeRequirements(category, requirements, { includeEvents: false }).map((l) => `- ${l}`);
  const anchor = budget ? roundNice(budget * ANCHOR_RATIO) : null;
  const wanted = Array.isArray(requirements.events_to_cover) ? (requirements.events_to_cover as string[]) : [];
  const events = wanted.length ? wedding.events.filter((e) => wanted.includes(e.name)) : wedding.events;
  const eventsIntro = events.length === 1 ? "Here are the details:" : "Here's what the weekend looks like:";
  return [
    events.length ? `${eventsIntro}\n${events.map(eventLine).join("\n")}` : null,
    reqs.length
      ? `For ${category.label.toLowerCase()}, they're hoping for:\n${reqs.join("\n")}`
      : `They're open to whatever package you'd recommend.`,
    anchor
      ? `They're thinking somewhere around ${formatMoney(anchor, wedding.currency)} for this, but we're happy to hear what you'd suggest.`
      : null,
    wedding.notes ? `A little more context: ${wedding.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const ASK =
  "Would you be able to send over pricing for this and let us know if you're available on those dates? " +
  "It would also help to know what's included (hours, travel, taxes). And if you have a gallery from a similar wedding, we'd love to see it.";

function assemble(input: QuoteRequestInput, opener: string): string {
  const couple = coupleProse(input.wedding);
  return [`Hi ${input.vendorName} team,`, opener, detailsBlock(input), ASK, `Thanks so much,\n${signature(couple)}`].join("\n\n");
}

export function templateQuoteRequest(input: QuoteRequestInput): { subject: string; text: string } {
  const opener = `I'm helping ${coupleProse(input.wedding)} plan their wedding in ${input.wedding.city}, and your work really stood out to us. We'd love to get a quote from you.`;
  return { subject: quoteSubject(input), text: stripDashes(assemble(input, opener)) };
}

const VOICE =
  "Write like a real person: plain, warm, conversational American English. Short sentences. " +
  "Never use em dashes or en dashes. No clichés like 'stunning', 'breathtaking' or 'I hope this email finds you well'. No placeholders.";

/** LLM writes a personalized opener; the facts block stays deterministic. Falls back to the template. */
export async function draftQuoteRequest(input: QuoteRequestInput): Promise<{ subject: string; text: string; usedLlm: boolean }> {
  try {
    const opener = await chatText(
      `You help a couple reach out to wedding vendors. ${VOICE} Output only the paragraph, no greeting and no sign-off.`,
      `Write a 2 sentence opening paragraph to ${input.vendorName}, a ${input.category.vendorNoun}. ` +
        `Say you're helping ${coupleProse(input.wedding)} plan their wedding in ${input.wedding.city} and would love a quote. ` +
        (input.vendorNotes ? `Mention one specific thing we liked about them, based on this: ${input.vendorNotes}. ` : "") +
        `Don't mention prices or dates; those come later in the email.`,
      { maxTokens: 160, timeoutMs: 60_000 },
    );
    const clean = stripDashes(opener.replace(/^["']|["']$/g, "").trim());
    if (clean.length < 40 || /\[.*?\]/.test(clean)) throw new Error("weak opener");
    return { subject: quoteSubject(input), text: stripDashes(assemble(input, clean)), usedLlm: true };
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
    `Thanks so much for getting back to us and for putting the quote together. ${c.couple} really like your work.`,
    `We're comparing a couple of options right now, and ${formatMoney(c.quotePrice, c.currency)} is a bit above where they'd like to land. Would you be able to do ${formatMoney(c.counterPrice, c.currency)} for the same package? If that's a stretch, we're open to trimming a few things to get closer to that number.`,
    `If the numbers work, they're ready to book soon.`,
    `Thanks again,\n${signature(c.couple)}`,
  ].join("\n\n");
}

export async function draftCounter(c: CounterInput & { quote: Quote }): Promise<{ text: string; usedLlm: boolean }> {
  try {
    const raw = await chatText(
      `You negotiate politely but firmly with wedding vendors over email on behalf of a couple. ${VOICE} ` +
        `Output only the email body. Start with "Hi ${c.vendorName} team," and end with exactly:\nThanks again,\n${signature(c.couple)}`,
      `Their quote: ${formatMoney(c.quotePrice, c.currency)}\nWhat they included: ${c.quote.inclusions.join("; ") || "not specified"}\nAvailability: ${c.quote.availability || "not stated"}\n\n` +
        `Write a short reply (under 120 words). Thank them, mention one thing from their quote, say we're comparing a couple of options, ` +
        `and ask if they could do exactly ${formatMoney(c.counterPrice, c.currency)} for the same package. ` +
        `If that's a stretch, say we're open to trimming a few things. Say the couple is ready to book soon if the numbers work.`,
      { maxTokens: 300, timeoutMs: 75_000 },
    );
    const text = stripDashes(raw);
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits.includes(String(c.counterPrice)) || /\[.*?\]/.test(text)) throw new Error("counter price missing");
    return { text, usedLlm: true };
  } catch {
    return { text: templateCounter(c), usedLlm: false };
  }
}

/** First money-looking number in an email: "$4,500", "4.5k", "USD 4500", "4,500 dollars". */
export function regexPrice(text: string): number | null {
  const m =
    text.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k)?\b/i) ||
    text.match(/usd\s*([\d,]+(?:\.\d+)?)\s*(k)?\b/i) ||
    text.match(/([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:dollars|usd)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(m[2] ? n * 1000 : n) : null;
}

export async function extractQuote(emailText: string, defaultCurrency = "USD"): Promise<Quote> {
  try {
    const q = await chatJSON<Partial<Quote>>(
      "You extract structured quote data from vendor emails. Reply ONLY with JSON.",
      `Email from a wedding vendor:\n"""\n${emailText.slice(0, 4000)}\n"""\n\n` +
        `Return {"price": number|null (the total price they are offering now, as a plain number), "currency": string|null (ISO code), "inclusions": string[], "availability": string|null, "notes": string|null (one sentence on anything else important)}`,
      { maxTokens: 400, timeoutMs: 75_000 },
    );
    return {
      price: typeof q.price === "number" && q.price > 0 ? q.price : regexPrice(emailText),
      currency: q.currency || defaultCurrency,
      inclusions: Array.isArray(q.inclusions) ? q.inclusions.map((x) => stripDashes(String(x))) : [],
      availability: q.availability ? stripDashes(q.availability) : null,
      notes: q.notes ? stripDashes(q.notes) : null,
    };
  } catch {
    return { price: regexPrice(emailText), currency: defaultCurrency, inclusions: [], availability: null, notes: null };
  }
}
