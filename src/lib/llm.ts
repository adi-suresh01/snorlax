import { env } from "./env";

type ChatOpts = { json?: boolean; maxTokens?: number; timeoutMs?: number; temperature?: number };

const isLocal = () => /localhost|127\.0\.0\.1/.test(env.llmBaseUrl);

/** One OpenAI-compatible chat call: local llama-server (Gemma) or a hosted API like Groq, picked by LLM_BASE_URL. */
async function chatOnce(system: string, user: string, opts: ChatOpts): Promise<string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.llmApiKey) headers.authorization = `Bearer ${env.llmApiKey}`;

  const res = await fetch(`${env.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    body: JSON.stringify({
      model: env.llmModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: opts.maxTokens ?? 700,
      temperature: opts.temperature ?? 0.4,
      // llama.cpp-only switch to skip Gemma's thinking phase; hosted APIs (Groq) don't accept it.
      ...(isLocal() ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error("LLM returned empty content");
  return content.trim();
}

async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
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
