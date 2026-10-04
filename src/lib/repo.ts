import { db } from "./db";
import type {
  CategoryRequest,
  Message,
  ProgressEvent,
  Quote,
  Requirements,
  RequestStatus,
  ResearchedVendor,
  Vendor,
  VendorStatus,
  Wedding,
} from "./types";

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toRequest(r: Record<string, unknown>): CategoryRequest {
  return { ...(r as unknown as CategoryRequest), budget: num(r.budget) };
}

function toVendor(r: Record<string, unknown>): Vendor {
  return {
    ...(r as unknown as Vendor),
    rating: num(r.rating),
    price_low: num(r.price_low),
    score: Number(r.score),
  };
}

// ── users ────────────────────────────────────────────────────────────────

export async function createUser(email: string, passwordHash: string): Promise<string> {
  const rows = await db()`insert into users (email, password_hash) values (${email}, ${passwordHash}) returning id`;
  return rows[0].id as string;
}

export async function findUserByEmail(email: string) {
  const rows = await db()`select id, email, password_hash from users where email = ${email}`;
  return (rows[0] as { id: string; email: string; password_hash: string } | undefined) ?? null;
}

// ── weddings ─────────────────────────────────────────────────────────────

export async function getWeddingByUser(userId: string): Promise<Wedding | null> {
  const rows = await db()`select * from weddings where user_id = ${userId}`;
  return (rows[0] as Wedding | undefined) ?? null;
}

export async function getWeddingById(id: string): Promise<Wedding | null> {
  const rows = await db()`select * from weddings where id = ${id}`;
  return (rows[0] as Wedding | undefined) ?? null;
}

export async function upsertWedding(userId: string, w: Omit<Wedding, "id" | "user_id">): Promise<Wedding> {
  const rows = await db()`
    insert into weddings (user_id, partner1, partner2, city, currency, events, notes)
    values (${userId}, ${w.partner1}, ${w.partner2}, ${w.city}, ${w.currency}, ${JSON.stringify(w.events)}::jsonb, ${w.notes})
    on conflict (user_id) do update set
      partner1 = excluded.partner1, partner2 = excluded.partner2, city = excluded.city,
      currency = excluded.currency, events = excluded.events, notes = excluded.notes, updated_at = now()
    returning *`;
  return rows[0] as Wedding;
}

// ── category requests ────────────────────────────────────────────────────

export async function listRequests(weddingId: string): Promise<CategoryRequest[]> {
  const rows = await db()`select * from category_requests where wedding_id = ${weddingId}`;
  return rows.map(toRequest);
}

export async function getRequest(weddingId: string, category: string): Promise<CategoryRequest | null> {
  const rows = await db()`select * from category_requests where wedding_id = ${weddingId} and category = ${category}`;
  return rows[0] ? toRequest(rows[0]) : null;
}

export async function getRequestById(id: string): Promise<CategoryRequest | null> {
  const rows = await db()`select * from category_requests where id = ${id}`;
  return rows[0] ? toRequest(rows[0]) : null;
}

export async function saveRequirements(
  weddingId: string,
  category: string,
  requirements: Requirements,
  budget: number | null,
): Promise<CategoryRequest> {
  const rows = await db()`
    insert into category_requests (wedding_id, category, requirements, budget)
    values (${weddingId}, ${category}, ${JSON.stringify(requirements)}::jsonb, ${budget})
    on conflict (wedding_id, category) do update set
      requirements = excluded.requirements, budget = excluded.budget, updated_at = now()
    returning *`;
  return toRequest(rows[0]);
}

/** Wipe previous results so a re-run starts clean. */
export async function resetRequest(id: string): Promise<void> {
  await db()`delete from vendors where request_id = ${id}`;
  await db()`update category_requests set status = 'researching', progress = '[]'::jsonb, error = null, updated_at = now() where id = ${id}`;
}

export async function setRequestStatus(id: string, status: RequestStatus, error: string | null = null): Promise<void> {
  await db()`update category_requests set status = ${status}, error = ${error}, updated_at = now() where id = ${id}`;
}

export async function appendProgress(id: string, step: string, message: string): Promise<void> {
  const event: ProgressEvent = { ts: new Date().toISOString(), step, message };
  await db()`
    update category_requests set progress = progress || ${JSON.stringify([event])}::jsonb, updated_at = now()
    where id = ${id}`;
}

// ── vendors ──────────────────────────────────────────────────────────────

export async function insertVendor(
  requestId: string,
  v: ResearchedVendor,
  score: number,
  shortlisted: boolean,
): Promise<Vendor> {
  const rows = await db()`
    insert into vendors (request_id, name, website, instagram, email, phone, location, price_estimate, price_low,
      rating, review_count, review_summary, style, images, fit_notes, sources, score, shortlisted, status)
    values (${requestId}, ${v.name}, ${v.website}, ${v.instagram}, ${v.email}, ${v.phone}, ${v.location},
      ${v.price_estimate}, ${v.price_low}, ${v.rating}, ${v.review_count}, ${v.review_summary}, ${v.style},
      ${JSON.stringify(v.images)}::jsonb, ${v.fit_notes}, ${JSON.stringify(v.sources)}::jsonb, ${score},
      ${shortlisted}, ${shortlisted ? "shortlisted" : "found"})
    returning *`;
  return toVendor(rows[0]);
}

export async function listVendors(requestId: string): Promise<Vendor[]> {
  const rows = await db()`select * from vendors where request_id = ${requestId} order by shortlisted desc, score desc`;
  return rows.map(toVendor);
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const rows = await db()`select * from vendors where id = ${id}`;
  return rows[0] ? toVendor(rows[0]) : null;
}

export async function findVendorByThread(threadId: string): Promise<Vendor | null> {
  const rows = await db()`select * from vendors where thread_id = ${threadId} limit 1`;
  return rows[0] ? toVendor(rows[0]) : null;
}

export async function markContacted(id: string, to: string, threadId: string): Promise<void> {
  await db()`update vendors set status = 'contacted', outreach_to = ${to}, thread_id = ${threadId} where id = ${id}`;
}

export async function setVendorStatus(id: string, status: VendorStatus): Promise<void> {
  await db()`update vendors set status = ${status} where id = ${id}`;
}

export async function setVendorQuote(id: string, status: VendorStatus, quote: Quote): Promise<void> {
  await db()`update vendors set status = ${status}, quote = ${JSON.stringify(quote)}::jsonb where id = ${id}`;
}

// ── messages ─────────────────────────────────────────────────────────────

export async function insertMessage(
  vendorId: string,
  direction: "in" | "out",
  agentmailMessageId: string | null,
  subject: string | null,
  body: string,
): Promise<void> {
  await db()`
    insert into messages (vendor_id, direction, agentmail_message_id, subject, body)
    values (${vendorId}, ${direction}, ${agentmailMessageId}, ${subject}, ${body})
    on conflict (agentmail_message_id) do nothing`;
}

export async function messageExists(agentmailMessageId: string): Promise<boolean> {
  const rows = await db()`select 1 from messages where agentmail_message_id = ${agentmailMessageId}`;
  return rows.length > 0;
}

export async function listMessagesForRequest(requestId: string): Promise<Message[]> {
  const rows = await db()`
    select m.* from messages m join vendors v on v.id = m.vendor_id
    where v.request_id = ${requestId} order by m.created_at asc`;
  return rows as Message[];
}

export async function hasOpenThreads(): Promise<boolean> {
  const rows = await db()`select 1 from vendors where thread_id is not null and status in ('contacted', 'replied') limit 1`;
  return rows.length > 0;
}
