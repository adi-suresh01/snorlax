import { describe, expect, it } from "vitest";
import { counterTarget, templateCounter, templateQuoteRequest } from "@/lib/emails";
import { getCategory } from "@/lib/categories";
import { stripDashes } from "@/lib/format";
import type { Wedding } from "@/lib/types";

const wedding: Wedding = {
  id: "w1",
  user_id: "u1",
  partner1: "Emma",
  partner2: "James",
  city: "Austin, TX",
  currency: "USD",
  events: [
    { name: "Rehearsal dinner", date: "2026-10-16", venue: "Lambert's", guests: 50 },
    { name: "Ceremony", date: "2026-10-17", venue: "Laguna Gloria", guests: 140 },
  ],
  notes: "",
};

const photography = getCategory("photography")!;

describe("templateQuoteRequest", () => {
  const email = templateQuoteRequest({
    wedding,
    category: photography,
    requirements: { photographers: 2, videographers: 1, engagement_shoot: true, events_to_cover: ["Rehearsal dinner", "Ceremony"] },
    budget: 8000,
    vendorName: "Lens & Light",
  });

  it("has a natural subject with the category and couple", () => {
    expect(email.subject).toContain("photography");
    expect(email.subject).toContain("Emma & James");
  });

  it("includes every event with a readable date, venue and guest count", () => {
    expect(email.text).toContain("Rehearsal dinner on Fri, Oct 16 at Lambert's (50 guests)");
    expect(email.text).toContain("Ceremony on Sat, Oct 17 at Laguna Gloria (140 guests)");
  });

  it("includes all filled requirements", () => {
    expect(email.text).toContain("Photographers: 2");
    expect(email.text).toContain("Videographers: 1");
    expect(email.text).toContain("Engagement shoot");
  });

  it("lists only the events this vendor is needed for", () => {
    const ceremonyOnly = templateQuoteRequest({
      wedding,
      category: photography,
      requirements: { events_to_cover: ["Ceremony"] },
      budget: null,
      vendorName: "Lens & Light",
    });
    expect(ceremonyOnly.text).toContain("Ceremony on Sat, Oct 17");
    expect(ceremonyOnly.text).not.toContain("Rehearsal dinner");
  });

  it("writes the couple as prose in the body", () => {
    expect(email.text).toContain("helping Emma and James plan");
  });

  it("greets the vendor and anchors below the real budget", () => {
    expect(email.text.startsWith("Hi Lens & Light team,")).toBe(true);
    expect(email.text).toContain("$6,800");
    expect(email.text).not.toContain("$8,000");
  });

  it("contains no em or en dashes", () => {
    expect(email.subject + email.text).not.toMatch(/[—–]/);
  });
});

describe("counterTarget", () => {
  it("asks ~12% below the quote when the quote is within budget", () => {
    expect(counterTarget(5000, 8000)).toBe(4400);
  });

  it("never exceeds the budget", () => {
    expect(counterTarget(12000, 8000)).toBe(8000);
  });

  it("works without a budget", () => {
    expect(counterTarget(1000, null)).toBe(880);
  });
});

describe("templateCounter", () => {
  const text = templateCounter({ vendorName: "Lens & Light", couple: "Emma & James", quotePrice: 5000, counterPrice: 4400, currency: "USD" });

  it("mentions the quoted and counter price", () => {
    expect(text).toContain("$5,000");
    expect(text).toContain("$4,400");
  });

  it("contains no em or en dashes", () => {
    expect(text).not.toMatch(/[—–]/);
  });
});

describe("stripDashes", () => {
  it("turns em dashes into commas and number ranges into 'to'", () => {
    expect(stripDashes("We loved it — truly")).toBe("We loved it, truly");
    expect(stripDashes("$3,500–$6,000")).toBe("$3,500–$6,000".replace("–", " to "));
    expect(stripDashes("8–10 hours")).toBe("8 to 10 hours");
  });
});
