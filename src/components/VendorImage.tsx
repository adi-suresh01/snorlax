"use client";

import { useState } from "react";

/** Remote vendor image with a monogram fallback when the URL is missing or blocks hotlinking. */
export function VendorImage({ src, name, className = "" }: { src: string | null | undefined; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-gradient-to-br from-rose/40 via-cream to-gold/30 ${className}`}>
        <span className="font-serif text-4xl font-semibold text-plum/70">{name.slice(0, 1)}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`${name} portfolio`} className={`object-cover ${className}`} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}
