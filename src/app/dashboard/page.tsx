import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { Nav } from "@/components/Nav";
import { requireSession } from "@/lib/auth";
import { coupleName } from "@/lib/emails";
import { getWeddingByUser } from "@/lib/repo";

export default async function DashboardPage() {
  const session = await requireSession();
  const wedding = await getWeddingByUser(session.userId);
  if (!wedding) redirect("/profile");
  const first = wedding.events.map((e) => e.date).filter(Boolean).sort()[0];
  return (
    <>
      <Nav couple={coupleName(wedding)} />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold">
          {wedding.city}
          {first ? ` · ${new Date(`${first}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""}
          {` · ${wedding.events.length} events`}
        </p>
        <h1 className="mt-1 font-serif text-5xl font-semibold">{coupleName(wedding)}</h1>
        <p className="mb-8 mt-2 text-muted">Pick a category, tell Snorlax what you need, and let it do the legwork.</p>
        <Dashboard currency={wedding.currency} />
      </main>
    </>
  );
}
