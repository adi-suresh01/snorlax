"use client";

import { formatMoney } from "@/lib/money";
import type { Vendor } from "@/lib/types";
import { StatusChip } from "./StatusChip";
import { VendorImage } from "./VendorImage";

export function VendorCard({ vendor: v, currency, onOpen }: { vendor: Vendor; currency: string; onOpen: () => void }) {
  const cur = v.quote?.currency || currency;
  return (
    <button onClick={onOpen} className="card group flex flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:border-plum/30">
      <VendorImage src={v.images[0]} name={v.name} className="h-40 w-full" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-xl font-semibold leading-tight group-hover:text-plum">{v.name}</h3>
          <StatusChip status={v.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {v.rating ? <span className="font-semibold text-gold">★ {v.rating}</span> : null}
          {v.review_count ? ` (${v.review_count} reviews)` : ""}
          {v.location ? ` · ${v.location}` : ""}
        </p>
        {v.price_estimate && <p className="mt-2 text-sm">{v.price_estimate}</p>}
        {v.fit_notes && <p className="mt-2 line-clamp-3 text-sm text-muted">{v.fit_notes}</p>}
        <div className="mt-auto pt-3">
          {v.quote?.price ? (
            <p className="rounded-xl bg-cream px-3 py-2 text-sm">
              Quoted <span className="font-semibold">{formatMoney(v.quote.price, cur)}</span>
              {v.quote.counter_price ? (
                <>
                  {" "}→ countered <span className="font-semibold text-plum">{formatMoney(v.quote.counter_price, cur)}</span>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-muted">Score {v.score} · click for details</p>
          )}
        </div>
      </div>
    </button>
  );
}
