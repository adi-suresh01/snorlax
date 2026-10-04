import { describe, expect, it } from "vitest";
import { cleanTitle, cleanVendorName } from "@/lib/exa";
import { stripDashes } from "@/lib/format";

describe("cleanVendorName", () => {
  it("drops page-title suffixes after a separator", () => {
    expect(cleanVendorName("Double Knot Pictures | Photo + Video")).toBe("Double Knot Pictures");
    expect(cleanVendorName("Franny Pullin Photography – Austin Wedding Photographer")).toBe("Franny Pullin Photography");
    expect(cleanVendorName("Lens & Light - Austin")).toBe("Lens & Light");
  });

  it("keeps names without separators and hyphenated words intact", () => {
    expect(cleanVendorName("Kristin La Voie Photography")).toBe("Kristin La Voie Photography");
    expect(cleanVendorName("Two-Bird Studio")).toBe("Two-Bird Studio");
  });
});

describe("cleanTitle", () => {
  it("collapses whitespace and removes dashes", () => {
    expect(cleanTitle("Austin Photography\n– Bellagala | National")).toBe("Austin Photography, Bellagala | National");
  });
});

describe("stripDashes price ranges", () => {
  it("reads hyphenated dollar ranges as 'to'", () => {
    expect(stripDashes("around $2,160-$2,600")).toBe("around $2,160 to $2,600");
  });

  it("leaves phone numbers alone", () => {
    expect(stripDashes("+1 512-730-0343")).toBe("+1 512-730-0343");
  });
});
