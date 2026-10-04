import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { getInbox, listReceived } from "../src/lib/agentmail";
import { chatJSON } from "../src/lib/llm";

type Check = [name: string, fn: () => Promise<string>];

const checks: Check[] = [
  [
    "Neon",
    async () => {
      const rows = await neon(process.env.DATABASE_URL!)`select count(*)::int as n from users`;
      return `users table ok (${rows[0].n} users)`;
    },
  ],
  [
    "Exa",
    async () => {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.EXA_API_KEY! },
        body: JSON.stringify({ query: "best wedding photographers in Udaipur", type: "auto", contents: { highlights: true } }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const data = await res.json();
      return `${data.results.length} results, first: ${data.results[0]?.title}`;
    },
  ],
  [
    "AgentMail",
    async () => {
      const inbox = await getInbox();
      const received = await listReceived(5);
      return `inbox ${inbox.inbox_id}, ${received.length} recent received`;
    },
  ],
  [
    "Gemma",
    async () => {
      const out = await chatJSON<{ price: number }>(
        "Reply ONLY with JSON.",
        'Email: "Our package is ₹2,50,000 all inclusive." Return {"price": number}',
        { maxTokens: 50 },
      );
      return `extracted price ${out.price}`;
    },
  ],
];

(async () => {
  let failed = 0;
  for (const [name, fn] of checks) {
    const t = Date.now();
    try {
      console.log(`✅ ${name}: ${await fn()} (${Date.now() - t}ms)`);
    } catch (err) {
      failed++;
      console.log(`❌ ${name}: ${(err as Error).message}`);
    }
  }
  process.exit(failed ? 1 : 0);
})();
