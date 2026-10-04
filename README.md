# 💤 Snorlax: you nap, we plan

Snorlax is a wedding-planning agent. A couple describes their wedding once, then for each vendor category
(photography, catering, florist, decor, makeup, music) adds their specific needs and a budget. Snorlax then:

1. **Researches** vendors on the web with the [Exa](https://exa.ai) Agent API: reviews, Instagram portfolios, pricing and contact details, with citations. A second focused Exa search per shortlisted vendor pulls portfolio photos and fills in missing contact info.
2. **Shortlists** the best 3 with a transparent score (rating 40 · review volume 20 · budget fit 25 · completeness 15).
3. **Emails** each one a detailed quote request from an [AgentMail](https://agentmail.to) inbox (`snorlax25@agentmail.to`) with every event, date, venue, guest count and requirement, anchored about 15% under budget. Emails are written to sound like a person, with no em dashes.
4. **Negotiates** the first round: watches the inbox, extracts the quote from the vendor's reply with an LLM on **Groq**, and sends one counter-offer (~12% under the quote, never above budget).

Everything shows up as cards: shortlist with portfolio images, contact details, sources, the extracted quote, and the full email thread.

> **Demo mode:** quote requests go to `DEMO_VENDOR_EMAILS` (a teammate plays the vendor) instead of real businesses. The real vendor contact is still shown in the UI.

## Stack

| Piece | Tech |
|---|---|
| App | Next.js 16 (App Router) + Tailwind v4 |
| DB | [Neon](https://neon.tech) Postgres (`@neondatabase/serverless`) |
| Web research | Exa Agent API (`/agent/runs`), fallback `/search` with `outputSchema` |
| Email | AgentMail REST API (send, reply, list) |
| LLM | [Groq](https://groq.com) (OpenAI-compatible; best available model picked automatically), template fallbacks. Any OpenAI-compatible server works via `LLM_BASE_URL` |
| Auth | bcrypt + JWT cookie |
| Deploy | Fly.io (Docker, standalone Next build) |

## Run locally

```bash
cp .env.example .env      # fill DATABASE_URL, EXA_API_KEY, AGENTMAIL_API_KEY, AUTH_SECRET
npm install
npm run migrate           # creates tables in Neon
npm run smoke             # checks Neon, Exa, AgentMail, LLM
npm run dev               # http://localhost:3000
```

LLM: set `LLM_API_KEY` to a Groq key. To use a local model instead, point `LLM_BASE_URL` at it (e.g. llama-server on `http://localhost:8080/v1`).

## Code map

```
src/lib/exa.ts        Exa research (agent → deep search → auto search)
src/lib/scoring.ts    shortlist scoring
src/lib/emails.ts     quote request / counter-offer drafting (LLM + deterministic templates)
src/lib/agentmail.ts  AgentMail REST client
src/lib/pipeline.ts   research → shortlist → outreach; reply poller + counter-offer
src/lib/repo.ts       all SQL
src/app/              pages + API routes
db/schema.sql         schema
```

## Tests

```bash
npm test
```
