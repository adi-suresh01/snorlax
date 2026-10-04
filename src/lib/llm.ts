import { env } from "./env";

type ChatOpts = { json?: boolean; maxTokens?: number; timeoutMs?: number; temperature?: number };

const isLocal = () => /localhost|127\.0\.0\.1/.test(env.llmBaseUrl);
const baseUrl = () => env.llmBaseUrl.replace(/\/$/, "");

/** Short provider name for progress logs, e.g. "Groq". */
export function llmName(): string {
  if (isLocal()) return "local model";
  if (/groq\.com/.test(env.llmBaseUrl)) return "Groq";
  return "LLM";
}

// Best-first. Non-reasoning models write emails fastest and handle JSON mode cleanly.
const PREFERRED = [
  "llama-3.3-70b-versatile",
  "moonshotai/kimi-k2-instruct-0905",
  "moonshotai/kimi-k2-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];
const NOT_CHAT = /whisper|tts|guard|prompt-guard|orpheus|distil|embed|vision-only|compound/i;

export function pickModel(available: string[]): string | null {
  for (const id of PREFERRED) if (available.includes(id)) return id;
  return available.find((id) => !NOT_CHAT.test(id)) ?? null;
}

/** Models that spend tokens thinking before answering; they need a reasoning budget. */
export function isReasoningModel(id: string): boolean {
  return /gpt-oss|qwen3|deepseek-r1|reasoning/i.test(id);
}

let resolvedModel: Promise<string> | null = null;

/** LLM_MODEL if set, otherwise the best model the API key can see (looked up once). */
function model(): Promise<string> {
  if (env.llmModel) return Promise.resolve(env.llmModel);
  resolvedModel ??= (async () => {
    const res = await fetch(`${baseUrl()}/models`, { headers: authHeaders(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`LLM /models HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const ids: string[] = ((await res.json()).data ?? []).map((m: { id: string }) => m.id);
    const picked = pickModel(ids);
    if (!picked) throw new Error(`No usable chat model in: ${ids.join(", ")}`);
    console.log(`[llm] using ${picked}`);
    return picked;
  })().catch((err) => {
    resolvedModel = null; // retry the lookup next time
    throw err;
  });
  return resolvedModel;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (env.llmApiKey) h.authorization = `Bearer ${env.llmApiKey}`;
  return h;
}

class RateLimited extends Error {
  constructor(public waitMs: number) {
    super(`LLM rate limited, retry in ${waitMs}ms`);
  }
}

/** One OpenAI-compatible chat call (Groq by default; any compatible server via LLM_BASE_URL). */
async function chatOnce(system: string, user: string, opts: ChatOpts): Promise<string> {
  const id = await model();
  const reasoning = isReasoningModel(id);
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    body: JSON.stringify({
      model: id,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // Reasoning models think before they answer; give them room so the answer isn't cut off.
      max_tokens: (opts.maxTokens ?? 700) + (reasoning ? 1500 : 0),
      temperature: opts.temperature ?? 0.4,
      ...(reasoning && !isLocal() ? { reasoning_effort: "low" } : {}),
      // llama.cpp-only switch to skip a local model's thinking phase.
      ...(isLocal() ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after"));
    throw new RateLimited(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 20_000) : 3000);
  }
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  // Some reasoning models inline <think>…</think>; keep only the answer.
  const answer = content?.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!answer) throw new Error("LLM returned empty content");
  return answer;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    if (err instanceof RateLimited) await new Promise((r) => setTimeout(r, err.waitMs));
    return withRetry(fn, retries - 1);
  }
}

export function chatText(system: string, user: string, opts: ChatOpts = {}): Promise<string> {
  return withRetry(() => chatOnce(system, user, opts));
}

export function chatJSON<T>(system: string, user: string, opts: ChatOpts = {}): Promise<T> {
  return withRetry(async () => {
    const raw = await chatOnce(system, user, { ...opts, json: true });
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw) as T;
  });
}
