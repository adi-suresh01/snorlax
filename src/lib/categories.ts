export type FieldType = "number" | "boolean" | "text" | "textarea" | "select" | "multiselect";

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

/** Every category also gets a budget field and an "events" picker in the UI. */
export const CATEGORIES: CategoryConfig[] = [
  {
    slug: "photography",
    label: "Photography",
    emoji: "📸",
    vendorNoun: "wedding photographer",
    blurb: "Photos, video, engagement shoot",
    fields: [
      { key: "photographers", label: "Photographers", type: "number", help: "Lead plus any second shooters" },
      { key: "videographers", label: "Videographers", type: "number" },
      { key: "hours", label: "Hours of coverage", type: "number" },
      { key: "engagement_shoot", label: "Engagement shoot", type: "boolean" },
      { key: "drone", label: "Drone footage", type: "boolean" },
      {
        key: "deliverables",
        label: "Deliverables",
        type: "multiselect",
        options: ["Online gallery", "Printed album", "Highlight film", "Full ceremony film", "Same-day edit", "Social media teasers"],
      },
      { key: "style", label: "Style", type: "textarea", placeholder: "Candid and documentary, light and airy, not too posed" },
    ],
  },
  {
    slug: "catering",
    label: "Catering",
    emoji: "🍽️",
    vendorNoun: "wedding caterer",
    blurb: "Menus, bar, late-night bites",
    fields: [
      { key: "service_style", label: "Service style", type: "select", options: ["Plated", "Buffet", "Family style", "Food stations", "Heavy hors d'oeuvres"] },
      { key: "menu", label: "Menu ideas", type: "textarea", placeholder: "Texas BBQ for dinner, a taco bar late night, passed apps during cocktail hour" },
      { key: "dietary", label: "Dietary needs", type: "multiselect", options: ["Vegetarian", "Vegan", "Gluten-free", "Nut-free", "Kosher", "Halal"] },
      { key: "extras", label: "Extras", type: "multiselect", options: ["Cocktail hour apps", "Late-night snacks", "Dessert table", "Cake cutting", "Coffee service"] },
      { key: "per_person_target", label: "Target per person ($)", type: "number" },
      { key: "bar", label: "Bar", type: "select", options: ["No bar", "Beer and wine", "Full open bar", "Signature cocktails"] },
    ],
  },
  {
    slug: "florist",
    label: "Florals",
    emoji: "💐",
    vendorNoun: "wedding florist",
    blurb: "Bouquets, arch, centerpieces",
    fields: [
      { key: "flowers", label: "Favorite flowers", type: "text", placeholder: "Garden roses, peonies, eucalyptus" },
      { key: "palette", label: "Color palette", type: "text", placeholder: "Blush, ivory and sage" },
      {
        key: "pieces",
        label: "What you need",
        type: "multiselect",
        options: ["Bridal bouquet", "Bridesmaid bouquets", "Boutonnieres", "Ceremony arch", "Aisle arrangements", "Centerpieces", "Corsages"],
      },
      { key: "notes", label: "Anything else", type: "textarea" },
    ],
  },
  {
    slug: "decor",
    label: "Decor & Rentals",
    emoji: "✨",
    vendorNoun: "wedding decor and rentals company",
    blurb: "Backdrops, lighting, lounges",
    fields: [
      { key: "theme", label: "Vibe", type: "text", placeholder: "Rustic barn, modern minimalist, garden party" },
      { key: "palette", label: "Color palette", type: "text" },
      {
        key: "items",
        label: "What you need",
        type: "multiselect",
        options: ["Ceremony backdrop", "Draping", "String lights", "Lounge furniture", "Linens", "Signage", "Dance floor"],
      },
      { key: "notes", label: "Anything else", type: "textarea" },
    ],
  },
  {
    slug: "makeup",
    label: "Hair & Makeup",
    emoji: "💄",
    vendorNoun: "bridal hair and makeup artist",
    blurb: "Bride, wedding party, trial",
    fields: [
      { key: "people", label: "Number of people", type: "number" },
      { key: "look", label: "Look", type: "select", options: ["Natural and soft", "Classic bridal", "Full glam", "Airbrush"] },
      { key: "trial", label: "Trial run", type: "boolean" },
      { key: "on_site", label: "On-site the morning of", type: "boolean" },
      { key: "notes", label: "Anything else", type: "textarea" },
    ],
  },
  {
    slug: "music",
    label: "Music",
    emoji: "🎶",
    vendorNoun: "wedding DJ or band",
    blurb: "DJ, band, ceremony music",
    fields: [
      { key: "acts", label: "Who you want", type: "multiselect", options: ["DJ", "Live band", "String quartet", "Acoustic guitarist", "MC"] },
      { key: "hours", label: "Hours", type: "number" },
      { key: "ceremony_music", label: "Ceremony music too", type: "boolean" },
      { key: "sound_lighting", label: "Sound and dance floor lighting", type: "boolean" },
      { key: "notes", label: "Must-plays and do-not-plays", type: "textarea" },
    ],
  },
];

export function getCategory(slug: string): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** One readable line per filled requirement, e.g. "Photographers: 2" or "Engagement shoot". */
export function describeRequirements(
  cat: CategoryConfig,
  req: Record<string, unknown>,
  { includeEvents = true } = {},
): string[] {
  const lines: string[] = [];
  const events = req.events_to_cover;
  if (includeEvents && Array.isArray(events) && events.length) lines.push(`Needed for: ${events.join(", ")}`);
  for (const f of cat.fields) {
    const v = req[f.key];
    if (v === undefined || v === null || v === "" || v === 0 || (Array.isArray(v) && v.length === 0)) continue;
    if (f.type === "boolean") {
      if (v === true) lines.push(f.label);
      continue;
    }
    lines.push(`${f.label}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  }
  return lines;
}
