import { describe, expect, it } from "vitest";
import { counterTarget, templateCounter, templateQuoteRequest } from "@/lib/emails";
import { getCategory } from "@/lib/categories";
import type { Wedding } from "@/lib/types";

const wedding: Wedding = {
  id: "w1",
  user_id: "u1",
  partner1: "Aditi",
  partner2: "Rohan",
  city: "Udaipur",
  currency: "INR",
  events: [
    { name: "Mehendi", date: "2026-12-10", venue: "Lake Pichola Lawns", guests: 150 },
    { name: "Wedding", date: "2026-12-11", venue: "City Palace", guests: 300 },
  ],
  notes: "",
};

const photography = getCategory("photography")!;

describe("templateQuoteRequest", () => {
  const email = templateQuoteRequest({
    wedding,
    category: photography,
    requirements: { candid_photographers: 2, videographers: 1, drone: true, events_to_cover: ["Mehendi", "Wedding"] },
    budget: 400000,
    vendorName: "Lens & Light",
  });

  it("puts the vendor, category and couple in the subject", () => {
    expect(email.subject).toContain("Lens & Light");
    expect(email.subject).toContain("Photography");
    expect(email.subject).toContain("Aditi & Rohan");
  });

  it("includes every event with date, venue and guest count", () => {
    for (const e of wedding.events) {
      expect(email.text).toContain(e.name);
      expect(email.text).toContain(e.venue);
      expect(email.text).toContain(String(e.guests));
    }
  });

  it("includes all filled requirements", () => {
    expect(email.text).toContain("Candid photographers: 2");
    expect(email.text).toContain("Videographers / cinematographers: 1");
    expect(email.text).toContain("Drone coverage: yes");
    expect(email.text).toContain("Events to cover: Mehendi, Wedding");
  });

  it("anchors below the real budget", () => {
    expect(email.text).toContain("3,40,000"); // 85% of 4,00,000 in en-IN grouping
    expect(email.text).not.toContain("4,00,000");
  });
});

describe("counterTarget", () => {
  it("asks ~12% below the quote when the quote is within budget", () => {
    expect(counterTarget(300000, 400000)).toBe(264000);
  });

  it("never exceeds the budget", () => {
    expect(counterTarget(600000, 400000)).toBe(400000);
  });

  it("works without a budget", () => {
    expect(counterTarget(1000, null)).toBe(880);
  });
});

describe("templateCounter", () => {
  it("mentions the quoted and counter price", () => {
    const text = templateCounter({
      vendorName: "Lens & Light",
      couple: "Aditi & Rohan",
      quotePrice: 300000,
      counterPrice: 264000,
      currency: "INR",
    });
    expect(text).toContain("3,00,000");
    expect(text).toContain("2,64,000");
  });
});
