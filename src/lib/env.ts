function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. Set it in .env`);
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get exaApiKey() {
    return required("EXA_API_KEY");
  },
  get agentmailApiKey() {
    return required("AGENTMAIL_API_KEY");
  },
  get agentmailInbox() {
    return process.env.AGENTMAIL_INBOX || "snorlax25@agentmail.to";
  },
  get demoVendorEmails(): string[] {
    return (process.env.DEMO_VENDOR_EMAILS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
  get llmBaseUrl() {
    return process.env.LLM_BASE_URL || "http://localhost:8080/v1";
  },
  get llmModel() {
    return process.env.LLM_MODEL || "gemma4-26b-a4b";
  },
  get llmApiKey() {
    return process.env.LLM_API_KEY || "";
  },
  get authSecret() {
    return new TextEncoder().encode(required("AUTH_SECRET"));
  },
};
