import { Nav } from "@/components/Nav";
import { ProfileForm } from "@/components/ProfileForm";
import { requireSession } from "@/lib/auth";
import { coupleName } from "@/lib/emails";
import { getWeddingByUser } from "@/lib/repo";

export default async function ProfilePage() {
  const session = await requireSession();
  const wedding = await getWeddingByUser(session.userId);
  return (
    <>
      <Nav couple={wedding ? coupleName(wedding) : undefined} />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-serif text-4xl font-semibold">{wedding ? "Your wedding" : "Tell us about your wedding"}</h1>
        <p className="mb-8 mt-2 text-muted">
          Snorlax shares these details with every vendor, so you never have to repeat yourself.
        </p>
        <ProfileForm initial={wedding} />
      </main>
    </>
  );
}
