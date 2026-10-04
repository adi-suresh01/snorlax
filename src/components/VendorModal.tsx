"use client";

import { useEffect } from "react";
import { formatMoney } from "@/lib/format";
import type { Message, Vendor } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { VendorImage } from "./VendorImage";

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function VendorModal({
  vendor: v,
  messages,
  currency,
  onClose,
}: {
  vendor: Vendor;
  messages: Message[];
  currency: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cur = v.quote?.currency || currency;
  const images = v.images.length ? v.images : [null];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={v.name}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-ivory shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`grid gap-1 ${images.length > 1 ? "grid-cols-2" : ""}`}>
          {images.slice(0, 4).map((src, i) => (
            <VendorImage key={i} src={src} name={v.name} className={images.length > 1 ? "h-44 w-full" : "h-56 w-full"} />
          ))}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl font-semibold">{v.name}</h2>
              <p className="text-sm text-muted">
                {v.rating ? <span className="font-semibold text-gold">★ {v.rating}</span> : null}
                {v.review_count ? ` · ${v.review_count} reviews` : ""}
                {v.location ? ` · ${v.location}` : ""}
                {` · score ${v.score}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip status={v.status} />
              <button onClick={onClose} aria-label="Close" className="btn-ghost h-9 w-9 p-0">✕</button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4">
              <h3 className="label">Contact</h3>
              <ul className="space-y-1.5 text-sm">
                {v.email && <li>✉️ <a className="text-plum underline-offset-2 hover:underline" href={`mailto:${v.email}`}>{v.email}</a></li>}
                {v.phone && <li>📞 <a className="text-plum underline-offset-2 hover:underline" href={`tel:${v.phone}`}>{v.phone}</a></li>}
                {v.instagram && <li>📷 <a className="text-plum underline-offset-2 hover:underline" href={v.instagram} target="_blank" rel="noreferrer">{v.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "")}</a></li>}
                {v.website && <li>🌐 <a className="text-plum underline-offset-2 hover:underline" href={v.website} target="_blank" rel="noreferrer">{host(v.website)}</a></li>}
                {!v.email && !v.phone && !v.instagram && !v.website && <li className="text-muted">No contact details found</li>}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <h3 className="label">Pricing</h3>
              <p className="text-sm">{v.price_estimate || "Not published"}</p>
              {v.quote?.price ? (
                <div className="mt-3 rounded-xl bg-cream p-3 text-sm">
                  <p>Quoted <span className="font-semibold">{formatMoney(v.quote.price, cur)}</span></p>
                  {v.quote.counter_price ? (
                    <p>Our counter <span className="font-semibold text-plum">{formatMoney(v.quote.counter_price, cur)}</span></p>
                  ) : null}
                  {v.quote.availability && <p className="mt-1 text-muted">Availability: {v.quote.availability}</p>}
                  {v.quote.inclusions.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-muted">
                      {v.quote.inclusions.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {(v.fit_notes || v.review_summary || v.style) && (
            <div className="mt-4 space-y-2 rounded-2xl bg-white p-4 text-sm">
              {v.fit_notes && <p><span className="font-semibold">Why Snorlax picked them:</span> {v.fit_notes}</p>}
              {v.review_summary && <p><span className="font-semibold">What reviewers say:</span> {v.review_summary}</p>}
              {v.style && <p><span className="font-semibold">Style:</span> {v.style}</p>}
            </div>
          )}

          {messages.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 font-serif text-xl font-semibold">Negotiation thread</h3>
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`max-w-[90%] rounded-2xl p-4 text-sm ${m.direction === "out" ? "ml-auto bg-plum text-ivory" : "bg-white"}`}>
                    <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${m.direction === "out" ? "text-ivory/70" : "text-gold"}`}>
                      {m.direction === "out" ? "Snorlax" : v.name} · {new Date(m.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {v.sources.length > 0 && (
            <div className="mt-6 text-xs text-muted">
              <span className="font-semibold uppercase tracking-wider">Sources: </span>
              {v.sources.map((s, i) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-plum hover:underline">
                  {s.title || host(s.url)}
                  {i < v.sources.length - 1 ? " · " : ""}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
