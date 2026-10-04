"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function Nav({ couple }: { couple?: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-30 border-b border-sand/70 bg-ivory/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-plum text-lg text-ivory">z</span>
          <span className="font-serif text-2xl font-semibold tracking-tight text-plum">Snorlax</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {couple && <span className="mr-2 hidden font-serif text-lg text-muted sm:inline">{couple}</span>}
          <Link href="/dashboard" className="btn-ghost">Vendors</Link>
          <Link href="/profile" className="btn-ghost">Wedding</Link>
          <button onClick={logout} className="btn-ghost">Log out</button>
        </nav>
      </div>
    </header>
  );
}
