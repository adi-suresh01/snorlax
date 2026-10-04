"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getCategory, type Field } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import type { CategoryRequest, Message, Requirements, Vendor, Wedding } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { VendorCard } from "./VendorCard";
import { VendorModal } from "./VendorModal";

type State = { request: CategoryRequest | null; vendors: Vendor[]; messages: Message[]; running: boolean };

const ACTIVE = ["researching", "shortlisted", "outreach_sent", "quotes_in", "negotiated"];

export function CategoryView({ slug, wedding, initial }: { slug: string; wedding: Wedding; initial: State }) {
  const category = getCategory(slug)!;
  const [state, setState] = useState<State>(initial);
  const [requirements, setRequirements] = useState<Requirements>({
    events_to_cover: wedding.events.map((e) => e.name),
    ...initial.request?.requirements,
  });
  const [budget, setBudget] = useState<string>(initial.request?.budget ? String(initial.request.budget) : "");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/requests/${slug}`, { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, [slug]);

  const status = state.request?.status ?? "needs_details";
  const polling = state.running || ACTIVE.includes(status);
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [polling, load]);

  async function submit(start: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/requests/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requirements, budget: Number(budget) || null, start }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Could not save");
    if (start) setEditing(false);
    await load();
  }

  async function checkReplies() {
    setChecking(true);
    await fetch("/api/replies", { method: "POST" });
    await load();
    setChecking(false);
  }

  const shortlist = state.vendors.filter((v) => v.shortlisted);
  const others = state.vendors.filter((v) => !v.shortlisted);
  const hasRun = !!state.request && status !== "needs_details";
  const showForm = !hasRun || editing;
  const selectedVendor = state.vendors.find((v) => v.id === selected) ?? null;

  const set = (key: string, value: Requirements[string]) => setRequirements((r) => ({ ...r, [key]: value }));

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <Link href="/dashboard" className="text-sm text-muted hover:text-plum">← All vendors</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-4xl">{category.emoji}</span>
        <h1 className="font-serif text-4xl font-semibold">{category.label}</h1>
        <StatusChip status={status} />
        {state.request?.budget ? (
          <span className="text-sm text-muted">Budget {formatMoney(state.request.budget, wedding.currency)}</span>
        ) : null}
      </div>

      <div className={`mt-6 grid gap-6 ${hasRun ? "lg:grid-cols-[1fr_22rem]" : ""}`}>
        <div className="space-y-6">
          {showForm && (
            <section className="card p-6">
              <h2 className="font-serif text-2xl font-semibold">What do you need?</h2>
              <p className="mb-5 text-sm text-muted">Snorlax includes all of this in every quote request.</p>

              <div className="mb-5">
                <span className="label">Events to cover</span>
                <div className="flex flex-wrap gap-2">
                  {wedding.events.map((e) => {
                    const list = (requirements.events_to_cover as string[]) || [];
                    const on = list.includes(e.name);
                    return (
                      <button
                        type="button"
                        key={e.name}
                        aria-pressed={on}
                        onClick={() => set("events_to_cover", on ? list.filter((x) => x !== e.name) : [...list, e.name])}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-plum bg-plum text-ivory" : "border-sand bg-white text-ink hover:border-plum/40"}`}
                      >
                        {e.name} · {e.guests}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {category.fields.map((f) => (
                  <FieldInput key={f.key} field={f} value={requirements[f.key]} onChange={(v) => set(f.key, v)} />
                ))}
                <div>
                  <label className="label" htmlFor="budget">Budget for {category.label.toLowerCase()} ($)</label>
                  <input id="budget" className="input" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="8000" />
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="btn px-6" disabled={busy || state.running} onClick={() => submit(true)}>
                  {busy ? "Starting…" : hasRun ? "Save & re-run agent" : "Find & negotiate ✨"}
                </button>
                <button className="btn-ghost" disabled={busy} onClick={() => submit(false)}>Save only</button>
                {hasRun && <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
              </div>
            </section>
          )}

          {hasRun && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-2xl font-semibold">Shortlist</h2>
                <div className="flex gap-2">
                  {["outreach_sent", "quotes_in", "negotiated"].includes(status) && (
                    <button className="btn-ghost" onClick={checkReplies} disabled={checking}>
                      {checking ? "Checking inbox…" : "Check replies"}
                    </button>
                  )}
                  {!showForm && <button className="btn-ghost" onClick={() => setEditing(true)}>Edit needs</button>}
                </div>
              </div>
              {shortlist.length ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {shortlist.map((v) => (
                    <VendorCard key={v.id} vendor={v} currency={wedding.currency} onOpen={() => setSelected(v.id)} />
                  ))}
                </div>
              ) : (
                <div className="card grid place-items-center p-10 text-center text-muted">
                  <div className="font-serif text-3xl text-plum">
                    <span className="snooze inline-block">z</span>
                    <span className="snooze inline-block [animation-delay:200ms]">z</span>
                    <span className="snooze inline-block [animation-delay:400ms]">z</span>
                  </div>
                  <p className="mt-2">{status === "error" ? state.request?.error : "Snorlax is reading reviews and portfolios…"}</p>
                </div>
              )}
              {others.length > 0 && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-muted">Also considered ({others.length})</summary>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {others.map((v) => (
                      <li key={v.id}>
                        <button className="w-full rounded-xl border border-sand bg-white px-3 py-2 text-left hover:border-plum/40" onClick={() => setSelected(v.id)}>
                          <span className="font-medium">{v.name}</span>
                          <span className="ml-2 text-muted">{v.rating ? `★ ${v.rating}` : ""} · score {v.score}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </div>

        {hasRun && (
          <aside className="card h-fit p-5 lg:sticky lg:top-20">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold">
              Agent activity
              {state.running && <span className="snooze text-plum">z</span>}
            </h2>
            <ol className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {[...(state.request?.progress ?? [])].reverse().map((p, i) => (
                <li key={`${p.ts}-${i}`} className="border-l-2 border-sand pl-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gold">
                    {p.step} · {new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                  <div className={`text-sm ${p.step === "error" ? "text-red-700" : "text-ink"}`}>{p.message}</div>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>

      {selectedVendor && (
        <VendorModal
          vendor={selectedVendor}
          messages={state.messages.filter((m) => m.vendor_id === selectedVendor.id)}
          currency={wedding.currency}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: Requirements[string]) => void }) {
  const id = `f-${field.key}`;
  const wide = field.type === "textarea" || field.type === "multiselect";
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      {field.type === "boolean" ? (
        <label className="flex h-full cursor-pointer items-center gap-3 rounded-xl border border-sand bg-white px-3.5 py-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-plum" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      ) : (
        <>
          <label className="label" htmlFor={id}>{field.label}</label>
          {field.type === "textarea" ? (
            <textarea id={id} className="input min-h-20" placeholder={field.placeholder} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
          ) : field.type === "select" ? (
            <select id={id} className="input" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
              <option value="">No preference</option>
              {field.options?.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : field.type === "multiselect" ? (
            <div className="flex flex-wrap gap-2" id={id}>
              {field.options?.map((o) => {
                const list = (value as string[]) || [];
                const on = list.includes(o);
                return (
                  <button
                    type="button"
                    key={o}
                    aria-pressed={on}
                    onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-plum bg-plum/10 text-plum" : "border-sand bg-white hover:border-plum/40"}`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              id={id}
              className="input"
              type={field.type === "number" ? "number" : "text"}
              min={field.type === "number" ? 0 : undefined}
              placeholder={field.placeholder}
              value={(value as string | number) ?? ""}
              onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
            />
          )}
          {field.help && <p className="mt-1 text-xs text-muted">{field.help}</p>}
        </>
      )}
    </div>
  );
}
