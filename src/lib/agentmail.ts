import { env } from "./env";

const BASE = "https://api.agentmail.to/v0";

export type AgentMailMessage = {
  message_id: string;
  thread_id: string;
  from: string;
  to: string[];
  subject?: string;
  labels: string[];
  timestamp: string;
  text?: string;
  extracted_text?: string;
  preview?: string;
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env.agentmailApiKey}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AgentMail ${init.method || "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

const inbox = () => encodeURIComponent(env.agentmailInbox);

export function sendMessage(to: string, subject: string, text: string) {
  return call<{ message_id: string; thread_id: string }>(`/inboxes/${inbox()}/messages/send`, {
    method: "POST",
    body: JSON.stringify({ to: [to], subject, text, labels: ["snorlax", "quote-request"] }),
  });
}

export function replyToMessage(messageId: string, text: string) {
  return call<{ message_id: string; thread_id: string }>(
    `/inboxes/${inbox()}/messages/${encodeURIComponent(messageId)}/reply`,
    { method: "POST", body: JSON.stringify({ text, labels: ["snorlax", "counter-offer"] }) },
  );
}

export async function listReceived(limit = 50): Promise<AgentMailMessage[]> {
  const data = await call<{ messages: AgentMailMessage[] }>(
    `/inboxes/${inbox()}/messages?limit=${limit}&labels=received`,
  );
  return data.messages || [];
}

export function getMessage(messageId: string) {
  return call<AgentMailMessage>(`/inboxes/${inbox()}/messages/${encodeURIComponent(messageId)}`);
}

export function getInbox() {
  return call<{ inbox_id: string }>(`/inboxes/${inbox()}`);
}
