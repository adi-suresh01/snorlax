export type WeddingEvent = {
  name: string;
  date: string;
  venue: string;
  guests: number;
};

export type Wedding = {
  id: string;
  user_id: string;
  partner1: string;
  partner2: string;
  city: string;
  currency: string;
  events: WeddingEvent[];
  notes: string;
};

export type RequestStatus =
  | "needs_details"
  | "researching"
  | "shortlisted"
  | "outreach_sent"
  | "quotes_in"
  | "negotiated"
  | "error";

export type ProgressEvent = { ts: string; step: string; message: string };

export type Requirements = Record<string, string | number | boolean | string[]>;

export type CategoryRequest = {
  id: string;
  wedding_id: string;
  category: string;
  requirements: Requirements;
  budget: number | null;
  status: RequestStatus;
  progress: ProgressEvent[];
  error: string | null;
  updated_at: string;
};

export type Quote = {
  price: number | null;
  currency: string | null;
  inclusions: string[];
  availability: string | null;
  notes: string | null;
  counter_price?: number | null;
};

export type VendorStatus =
  | "found"
  | "shortlisted"
  | "contacted"
  | "send_failed"
  | "replied"
  | "countered";

export type Source = { url: string; title?: string };

/** A vendor as returned by web research, before persistence. */
export type ResearchedVendor = {
  name: string;
  website: string | null;
  instagram: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  price_estimate: string | null;
  price_low: number | null;
  rating: number | null;
  review_count: number | null;
  review_summary: string | null;
  style: string | null;
  images: string[];
  fit_notes: string | null;
  sources: Source[];
};

export type Vendor = ResearchedVendor & {
  id: string;
  request_id: string;
  score: number;
  shortlisted: boolean;
  status: VendorStatus;
  outreach_to: string | null;
  thread_id: string | null;
  quote: Quote | null;
};

export type Message = {
  id: string;
  vendor_id: string;
  direction: "in" | "out";
  agentmail_message_id: string | null;
  subject: string | null;
  body: string;
  created_at: string;
};
