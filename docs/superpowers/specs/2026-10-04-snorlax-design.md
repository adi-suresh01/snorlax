# Snorlax — Wedding Vendor Agent — Design

Date: 2026-10-04 · Context: 2-hour hackathon, single end-to-end web demo.

## Goal

A couple logs in, describes their wedding once, then for each vendor category
(photography, catering, florist, decor, makeup, music) gives category-specific
needs and a budget. The agent researches vendors on the web, shortlists the best
3, emails each one a detailed quote request, reads replies, and sends one
counter-offer. The couple sees everything as cards.

## Decisions

| Topic | Decision |
|---|---|
| App shape | Next.js (App Router, TypeScript) + Tailwind, one app, one deploy |
| Orchestration | Approach A: plain TS pipeline steps run in-process in the background. Mastra wrapper is optional, last |
| Database | Neon Postgres (project `divine-field-83555869`, branch `br-bold-bonus-b4zia0vr`), `@neondatabase/serverless`, raw SQL |
| Auth | Email + password, bcryptjs hash, JWT (jose) in httpOnly cookie |
| Web research | Exa Agent API (`/agent/runs`, explicit `effort`, `outputSchema`, poll to terminal status). Fallback: `/search` with `type: "deep"`, `outputSchema`, `contents.highlights` |
| LLM | Local Gemma (`gemma4-26b-a4b`) via llama-server, OpenAI-compatible `LLM_BASE_URL`, thinking disabled (`chat_template_kwargs.enable_thinking=false`), JSON mode |
| Email | AgentMail inbox `snorlax25@agentmail.to` |
| Outreach recipients | Demo mode only: emails go to `DEMO_VENDOR_EMAILS` (round-robin); real vendor contact shown in UI only |
| Reply detection | Polling AgentMail (no public webhook needed) |
| Budget | Per category, picked by the user on the category form. No total budget in the profile |
| Deploy | Fly.io at the end; `LLM_BASE_URL` → cloudflared tunnel to llama-server (with `--api-key`), template fallback if unreachable |

## User flow

1. **Signup / login.**
2. **Wedding profile** (`/profile`): partner 1, partner 2, city, currency (INR/USD), events list
   (name, date, venue, expected guests), free-text notes. Stored on `weddings`.
3. **Dashboard** (`/dashboard`): one card per category with status chip:
   `needs_details → researching → shortlisted → outreach_sent → quotes_in → negotiated` (or `error`).
   Card shows count of shortlisted vendors and best quote when present.
4. **Category page** (`/category/[slug]`):
   - Category-specific form (config-driven) + budget. Examples:
     - Photography: candid photographers (#), traditional photographers (#), videographers (#), drone (y/n),
       pre-wedding shoot (y/n), deliverables (album, highlight film), events to cover, style notes.
     - Catering: cuisines per event, veg / non-veg / jain, live counters (list), per-plate target, bar service.
     - Florist: flower preferences, color palette, events needing florals, mandap/stage florals.
     - Decor: theme, color palette, events, stage/mandap, lighting.
     - Makeup: number of people, events, style (natural/glam), trial needed.
     - Music: DJ / live band / dhol, events, hours, sound+lighting needed.
   - "Find & negotiate" button starts the pipeline.
   - Live progress log (polled every 2s).
   - Shortlist: 3 vendor cards — image, name, rating + review count, price estimate, style, why picked.
5. **Vendor detail** (expand/modal): portfolio images, review summary, contact (email, phone,
   Instagram, website), sources (citations), email thread, extracted quote, counter-offer.

## Agent pipeline (per category request)

1. **Research** — Exa Agent run: query built from city, dates, category, requirements, budget.
   Schema: `vendors[]` (maxItems 8) with `name, website, instagram, email, phone, location,
   price_estimate, rating, review_count, review_summary, style, portfolio_image_urls[], fit_notes`.
   On failure or >150s: fallback to `/search` deep with same schema.
   Images: schema image URLs; else og:image fetched from the vendor website.
2. **Shortlist** — deterministic score: rating (40%), review volume (20%), budget fit (25%),
   completeness of contact/portfolio (15%). Top 3 → `shortlisted = true`.
3. **Outreach** — for each shortlisted vendor, Gemma drafts a quote-request email containing all
   wedding + category details and asks for an itemized quote, availability, and inclusions.
   Template fallback on LLM error/timeout. Sent via AgentMail to the demo inbox; subject
   `Quote request: <category> for <couple> wedding — <vendor name>`. Store thread/message ids.
4. **Replies + one counter** — poller (runs while any request is in `outreach_sent`/`quotes_in`,
   also on "Check replies" click) lists inbox messages; new inbound message in a known thread →
   Gemma extracts `{price, currency, inclusions[], availability, notes}` → Gemma drafts one
   polite counter (target ~10–15% below quote, never above budget, cite competing options) →
   reply in thread. Vendor status `countered`. Only one counter per vendor.

Progress events (`{ts, step, message}`) are appended to `category_requests.progress` for the UI.

## Data model

- `users(id uuid pk, email unique, password_hash, created_at)`
- `weddings(id uuid pk, user_id fk unique, partner1, partner2, city, currency, events jsonb, notes, updated_at)`
- `category_requests(id uuid pk, wedding_id fk, category, requirements jsonb, budget numeric,
  status, progress jsonb, error, created_at, updated_at)` — unique (wedding_id, category)
- `vendors(id uuid pk, request_id fk, name, website, instagram, email, phone, location,
  price_estimate, rating, review_count, review_summary, style, images jsonb, fit_notes,
  sources jsonb, score, shortlisted bool, status, outreach_to, thread_id, quote jsonb, created_at)`
- `messages(id uuid pk, vendor_id fk, direction in|out, agentmail_message_id unique, subject,
  body, created_at)`

## Error handling

- Every step wrapped; failures append a progress event and set `error` without crashing the app.
- LLM: 90s timeout, one retry, then template.
- Exa Agent: poll to terminal status; non-`completed` → fallback search.
- AgentMail send failure → vendor status `send_failed`, shown on card.

## Testing

- `scripts/smoke.ts`: checks Neon connectivity, Exa search, AgentMail inbox access, Gemma JSON.
- Unit tests for the scoring function and template builders (vitest).
- Manual E2E: photography request → shortlist → emails land in demo inbox → reply → counter appears.

## Out of scope

Real vendor outreach, booking/payment, Kernel browser automation, multi-round negotiation,
Neon AI Gateway, multi-user collaboration.
