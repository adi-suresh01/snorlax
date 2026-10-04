"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Wedding, WeddingEvent } from "@/lib/types";

const DEFAULT_EVENTS: WeddingEvent[] = [
  { name: "Mehendi", date: "", venue: "", guests: 150 },
  { name: "Sangeet", date: "", venue: "", guests: 200 },
  { name: "Wedding", date: "", venue: "", guests: 300 },
  { name: "Reception", date: "", venue: "", guests: 350 },
];

export function ProfileForm({ initial }: { initial: Wedding | null }) {
  const router = useRouter();
  const [partner1, setPartner1] = useState(initial?.partner1 ?? "");
  const [partner2, setPartner2] = useState(initial?.partner2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "INR");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [events, setEvents] = useState<WeddingEvent[]>(initial?.events?.length ? initial.events : DEFAULT_EVENTS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updateEvent = (i: number, patch: Partial<WeddingEvent>) =>
    setEvents((evs) => evs.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ partner1, partner2, city, currency, notes, events }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not save");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="p1">Bride / Partner 1</label>
          <input id="p1" className="input" required value={partner1} onChange={(e) => setPartner1(e.target.value)} placeholder="Aditi" />
        </div>
        <div>
          <label className="label" htmlFor="p2">Groom / Partner 2</label>
          <input id="p2" className="input" required value={partner2} onChange={(e) => setPartner2(e.target.value)} placeholder="Rohan" />
        </div>
        <div>
          <label className="label" htmlFor="city">City</label>
          <input id="city" className="input" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Udaipur" />
        </div>
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <select id="currency" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="INR">INR ₹</option>
            <option value="USD">USD $</option>
          </select>
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">Events</h2>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setEvents((evs) => [...evs, { name: "", date: "", venue: "", guests: 100 }])}
          >
            + Add event
          </button>
        </div>
        <div className="space-y-3">
          {events.map((ev, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-cream/60 p-3 sm:grid-cols-[1fr_9rem_1.4fr_6rem_auto]">
              <input className="input" aria-label="Event name" placeholder="Event" value={ev.name} onChange={(e) => updateEvent(i, { name: e.target.value })} />
              <input className="input" aria-label="Date" type="date" value={ev.date} onChange={(e) => updateEvent(i, { date: e.target.value })} />
              <input className="input" aria-label="Venue" placeholder="Venue" value={ev.venue} onChange={(e) => updateEvent(i, { venue: e.target.value })} />
              <input className="input" aria-label="Guests" type="number" min={0} value={ev.guests} onChange={(e) => updateEvent(i, { guests: Number(e.target.value) })} />
              <button type="button" aria-label={`Remove ${ev.name || "event"}`} className="text-sm text-muted hover:text-plum" onClick={() => setEvents((evs) => evs.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <label className="label" htmlFor="notes">Anything vendors should know?</label>
        <textarea id="notes" className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Destination wedding, families flying in from abroad, eco-friendly preferred…" />
      </section>

      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button className="btn px-8 py-3" disabled={busy}>{busy ? "Saving…" : "Save & find vendors →"}</button>
    </form>
  );
}
