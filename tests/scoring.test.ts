import { describe, expect, it } from "vitest";
import { pickShortlist, scoreVendor } from "@/lib/scoring";
import type { ResearchedVendor } from "@/lib/types";

function vendor(overrides: Partial<ResearchedVendor>): ResearchedVendor {
  return {
    name: "Studio",
    website: null,
    instagram: null,
    email: null,
    phone: null,
    location: null,
    price_estimate: null,
    price_low: null,
    rating: null,
    review_count: null,
    review_summary: null,
    style: null,
    images: [],
    fit_notes: null,
    sources: [],
    ...overrides,
  };
}

describe("scoreVendor", () => {
  it("ranks a higher-rated vendor above a lower-rated one, all else equal", () => {
    expect(scoreVendor(vendor({ rating: 4.9 }), 100000)).toBeGreaterThan(scoreVendor(vendor({ rating: 3.9 }), 100000));
  });

  it("penalises vendors priced over budget", () => {
    const within = scoreVendor(vendor({ rating: 4.5, price_low: 80000 }), 100000);
    const over = scoreVendor(vendor({ rating: 4.5, price_low: 180000 }), 100000);
    expect(within).toBeGreaterThan(over);
  });

  it("gives no budget credit to a vendor 50% or more over budget", () => {
    const wayOver = scoreVendor(vendor({ rating: 5, price_low: 12000 }), 8000);
    const unknown = scoreVendor(vendor({ rating: 5 }), 8000);
    expect(unknown - wayOver).toBeCloseTo(12.5, 1);
  });

  it("rewards more reviews and complete contact info", () => {
    const sparse = scoreVendor(vendor({ rating: 4.5 }), null);
    const rich = scoreVendor(
      vendor({ rating: 4.5, review_count: 300, email: "a@b.com", phone: "1", instagram: "x", images: ["i"] }),
      null,
    );
    expect(rich).toBeGreaterThan(sparse);
  });

  it("stays within 0..100", () => {
    const s = scoreVendor(
      vendor({ rating: 5, review_count: 100000, price_low: 1, email: "a", phone: "b", instagram: "c", website: "d", images: ["e"] }),
      100,
    );
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("pickShortlist", () => {
  it("returns the top n by score, de-duplicated by name", () => {
    const vs = [
      vendor({ name: "A Studio", rating: 4.1 }),
      vendor({ name: "B Studio", rating: 4.9 }),
      vendor({ name: "b studio", rating: 4.8 }),
      vendor({ name: "C Studio", rating: 4.5 }),
      vendor({ name: "D Studio", rating: 3.0 }),
    ];
    const picked = pickShortlist(vs, null, 3).map((v) => v.name);
    expect(picked).toEqual(["B Studio", "C Studio", "A Studio"]);
  });

  it("returns fewer than n when there are not enough vendors", () => {
    expect(pickShortlist([vendor({ name: "Solo" })], null, 3)).toHaveLength(1);
  });
});
