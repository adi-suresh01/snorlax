import { describe, expect, it } from "vitest";
import { pickPortfolioImages } from "@/lib/exa";

describe("pickPortfolioImages", () => {
  it("keeps photos, drops icons/logos/svg/non-images, upsizes CDN thumbnails and dedupes", () => {
    const out = pickPortfolioImages([
      "https://image.wedmegood.com/resized/450X/uploads/member/1/a.jpg?crop=1,2,3,4",
      "https://image.wedmegood.com/resized/1000X/uploads/member/1/a.jpg",
      "https://image.wedmegood.com/resized/20X/images/icons/write_a_review_new.png",
      "https://example.com/logo.png",
      "https://example.com/vector/photographer.svg",
      "https://www.wedmegood.com/photos/p-photo-3xxzAvf",
      "https://cdn.example.com/portfolio/b.webp",
    ]);
    expect(out).toEqual([
      "https://image.wedmegood.com/resized/800X/uploads/member/1/a.jpg?crop=1,2,3,4",
      "https://cdn.example.com/portfolio/b.webp",
    ]);
  });

  it("treats WordPress resized copies as duplicates", () => {
    expect(
      pickPortfolioImages(["https://s.com/up/091A-copy-683x1024.jpg", "https://s.com/up/091A-copy.jpg"]),
    ).toEqual(["https://s.com/up/091A-copy-683x1024.jpg"]);
  });

  it("caps the number of images", () => {
    const urls = Array.from({ length: 10 }, (_, i) => `https://cdn.example.com/p/${i}.jpg`);
    expect(pickPortfolioImages(urls, 4)).toHaveLength(4);
  });
});
