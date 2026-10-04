const LABELS: Record<string, { text: string; cls: string }> = {
  needs_details: { text: "Needs details", cls: "bg-cream text-muted" },
  researching: { text: "Researching", cls: "bg-amber-100 text-amber-800" },
  shortlisted: { text: "Shortlisted", cls: "bg-sky-100 text-sky-800" },
  outreach_sent: { text: "Quotes requested", cls: "bg-violet-100 text-violet-800" },
  quotes_in: { text: "Quotes in", cls: "bg-emerald-100 text-emerald-800" },
  negotiated: { text: "Negotiating", cls: "bg-plum text-ivory" },
  error: { text: "Needs attention", cls: "bg-red-100 text-red-800" },
  // vendor statuses
  found: { text: "Considered", cls: "bg-cream text-muted" },
  contacted: { text: "Awaiting reply", cls: "bg-violet-100 text-violet-800" },
  send_failed: { text: "Email failed", cls: "bg-red-100 text-red-800" },
  replied: { text: "Quoted", cls: "bg-emerald-100 text-emerald-800" },
  countered: { text: "Countered", cls: "bg-plum text-ivory" },
};

export function StatusChip({ status }: { status: string }) {
  const s = LABELS[status] ?? { text: status, cls: "bg-cream text-muted" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.text}</span>;
}
