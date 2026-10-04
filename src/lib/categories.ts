export type FieldType = "number" | "boolean" | "text" | "textarea" | "select" | "multiselect" | "events";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  help?: string;
};

export type CategoryConfig = {
  slug: string;
  label: string;
  emoji: string;
  /** Noun used in search queries and emails, e.g. "wedding photographer". */
  vendorNoun: string;
  blurb: string;
  fields: Field[];
};

/** Every category also gets a budget field and an "events to cover" picker in the UI. */
export const CATEGORIES: CategoryConfig[] = [
  {
    slug: "photography",
    label: "Photography",
    emoji: "📸",
    vendorNoun: "wedding photographer and videographer studio",
    blurb: "Candid, traditional, films",
    fields: [
      { key: "candid_photographers", label: "Candid photographers", type: "number" },
      { key: "traditional_photographers", label: "Traditional photographers", type: "number" },
      { key: "videographers", label: "Videographers / cinematographers", type: "number" },
      { key: "drone", label: "Drone coverage", type: "boolean" },
      { key: "pre_wedding_shoot", label: "Pre-wedding shoot", type: "boolean" },
      {
        key: "deliverables",
        label: "Deliverables",
        type: "multiselect",
        options: ["Edited photos", "Printed album", "Highlight film", "Full-length film", "Same-day edit", "Instagram reels"],
      },
      { key: "style", label: "Style notes", type: "textarea", placeholder: "Documentary, warm tones, minimal posing…" },
    ],
  },
  {
    slug: "catering",
    label: "Catering",
    emoji: "🍛",
    vendorNoun: "wedding caterer",
    blurb: "Menus, live counters",
    fields: [
      {
        key: "cuisines",
        label: "Food per event",
        type: "textarea",
        placeholder: "Mehendi: chaat + Rajasthani; Sangeet: North Indian + Continental; Wedding: South Indian sadya…",
      },
      { key: "diet", label: "Dietary", type: "multiselect", options: ["Vegetarian", "Non-vegetarian", "Jain", "Vegan options", "Gluten-free options"] },
      {
        key: "live_counters",
        label: "Live counters",
        type: "multiselect",
        options: ["Chaat", "Dosa", "Pasta", "Tandoor", "Biryani", "Mocktail bar", "Desserts / jalebi", "Paan"],
      },
      { key: "per_plate_target", label: "Per-plate target", type: "number", help: "In your currency" },
      { key: "bar_service", label: "Bar service needed", type: "boolean" },
      { key: "notes", label: "Other notes", type: "textarea" },
    ],
  },
  {
    slug: "florist",
    label: "Florist",
    emoji: "💐",
    vendorNoun: "wedding florist",
    blurb: "Mandap, garlands, centerpieces",
    fields: [
      { key: "flowers", label: "Preferred flowers", type: "text", placeholder: "Marigold, roses, orchids, tuberose" },
      { key: "palette", label: "Color palette", type: "text", placeholder: "Ivory, blush, gold" },
      {
        key: "pieces",
        label: "Pieces needed",
        type: "multiselect",
        options: ["Mandap florals", "Stage backdrop", "Varmala garlands", "Table centerpieces", "Entrance arch", "Car decoration", "Bridal floral jewelry"],
      },
      { key: "notes", label: "Other notes", type: "textarea" },
    ],
  },
  {
    slug: "decor",
    label: "Decor",
    emoji: "✨",
    vendorNoun: "wedding decorator",
    blurb: "Themes, stage, lighting",
    fields: [
      { key: "theme", label: "Theme", type: "text", placeholder: "Royal Rajasthani, boho garden, minimal modern…" },
      { key: "palette", label: "Color palette", type: "text" },
      { key: "stage_mandap", label: "Stage / mandap design", type: "boolean" },
      { key: "lighting", label: "Lighting design", type: "boolean" },
      { key: "notes", label: "Other notes", type: "textarea" },
    ],
  },
  {
    slug: "makeup",
    label: "Makeup & Hair",
    emoji: "💄",
    vendorNoun: "bridal makeup artist",
    blurb: "Bride, family, trials",
    fields: [
      { key: "people", label: "Number of people", type: "number" },
      { key: "look", label: "Look", type: "select", options: ["Natural / dewy", "Classic bridal", "Glam", "HD / airbrush"] },
      { key: "trial", label: "Trial session", type: "boolean" },
      { key: "notes", label: "Other notes", type: "textarea" },
    ],
  },
  {
    slug: "music",
    label: "DJ & Music",
    emoji: "🎶",
    vendorNoun: "wedding DJ and live music act",
    blurb: "DJ, band, dhol",
    fields: [
      { key: "acts", label: "Acts", type: "multiselect", options: ["DJ", "Live band", "Dhol players", "Sufi / qawwali", "Classical ensemble", "Emcee / anchor"] },
      { key: "hours", label: "Hours per event", type: "number" },
      { key: "sound_lighting", label: "Sound + lighting rig needed", type: "boolean" },
      { key: "notes", label: "Other notes", type: "textarea" },
    ],
  },
];

export function getCategory(slug: string): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Human-readable "Label: value" lines for every filled requirement. */
export function describeRequirements(cat: CategoryConfig, req: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const events = req.events_to_cover;
  if (Array.isArray(events) && events.length) lines.push(`Events to cover: ${events.join(", ")}`);
  for (const f of cat.fields) {
    const v = req[f.key];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if (f.type === "boolean") {
      if (v === true) lines.push(`${f.label}: yes`);
      continue;
    }
    lines.push(`${f.label}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  }
  return lines;
}
