import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";

export default async function Home() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-plum text-lg text-ivory">z</span>
          <span className="font-serif text-2xl font-semibold text-plum">Snorlax</span>
        </div>
        <div className="flex gap-2">
          <Link href="/login" className="btn-ghost">Log in</Link>
          <Link href="/signup" className="btn">Start planning</Link>
        </div>
      </header>

      <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-sand bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted">
            <span className="snooze">z</span><span className="snooze [animation-delay:200ms]">z</span>
            <span className="snooze [animation-delay:400ms]">z</span> wedding planning agent
          </p>
          <h1 className="font-serif text-6xl font-semibold leading-[1.02] text-ink sm:text-7xl">
            You nap.
            <br />
            <span className="text-plum">We plan.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
            Tell Snorlax about your wedding once. It scours reviews, portfolios and Instagram, shortlists the best
            vendors for your budget, emails them every detail, and negotiates the first round of quotes for you.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/signup" className="btn px-7 py-3 text-base">Plan my wedding</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {CATEGORIES.map((c, i) => (
            <div key={c.slug} className={`card p-5 ${i % 2 ? "translate-y-6" : ""}`}>
              <div className="text-3xl">{c.emoji}</div>
              <div className="mt-3 font-serif text-xl font-semibold">{c.label}</div>
              <div className="text-sm text-muted">{c.blurb}</div>
            </div>
          ))}
        </div>
      </section>
      <footer className="py-6 text-xs text-muted">Built with Exa · AgentMail · Neon · Groq</footer>
    </main>
  );
}
