"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { StatusChip } from "./StatusChip";

type Summary = {
  category: string;
  status: string;
  budget: number | null;
  running: boolean;
  shortlisted: { name: string; image: string | null; status: string }[];
  bestQuote: number | null;
  lastEvent: string | null;
};

export function Dashboard({ currency }: { currency: string }) {
  const [summary, setSummary] = useState<Record<string, Summary>>({});

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch("/api/requests", { cache: "no-store" });
      if (!res.ok || !alive) return;
      const data = await res.json();
      setSummary(Object.fromEntries((data.summary as Summary[]).map((s) => [s.category, s])));
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORIES.map((c) => {
        const s = summary[c.slug];
        return (
          <Link key={c.slug} href={`/category/${c.slug}`} className="card group flex flex-col p-6 transition hover:-translate-y-0.5 hover:border-plum/30">
            <div className="flex items-start justify-between">
              <span className="text-4xl">{c.emoji}</span>
              <StatusChip status={s?.status ?? "needs_details"} />
            </div>
            <h2 className="mt-4 font-serif text-2xl font-semibold group-hover:text-plum">{c.label}</h2>
            <p className="text-sm text-muted">{c.blurb}</p>

            {s?.shortlisted.length ? (
              <div className="mt-5 flex items-center gap-3">
                <div className="flex -space-x-3">
                  {s.shortlisted.map((v) => (
                    <div key={v.name} className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-cream" title={v.name}>
                      {v.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-xs font-bold text-plum">{v.name[0]}</span>
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-muted">{s.shortlisted.length} shortlisted</span>
              </div>
            ) : null}

            <div className="mt-auto pt-5 text-sm">
              {s?.bestQuote ? (
                <p>
                  Best quote <span className="font-semibold text-plum">{formatMoney(s.bestQuote, currency)}</span>
                </p>
              ) : s?.budget ? (
                <p className="text-muted">Budget {formatMoney(s.budget, currency)}</p>
              ) : (
                <p className="text-muted">Add your needs →</p>
              )}
              {s?.running || s?.status === "researching" ? (
                <p className="mt-1 truncate text-xs text-muted">
                  <span className="snooze inline-block">z</span> {s.lastEvent}
                </p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
