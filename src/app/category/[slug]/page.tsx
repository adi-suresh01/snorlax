import { notFound, redirect } from "next/navigation";
import { CategoryView } from "@/components/CategoryView";
import { Nav } from "@/components/Nav";
import { requireSession } from "@/lib/auth";
import { getCategory } from "@/lib/categories";
import { coupleName } from "@/lib/emails";
import { isRunning } from "@/lib/pipeline";
import { getRequest, getWeddingByUser, listMessagesForRequest, listVendors } from "@/lib/repo";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const session = await requireSession();
  const wedding = await getWeddingByUser(session.userId);
  if (!wedding) redirect("/profile");
  const request = await getRequest(wedding.id, category.slug);
  const [vendors, messages] = request
    ? await Promise.all([listVendors(request.id), listMessagesForRequest(request.id)])
    : [[], []];
  const initial = { request, vendors, messages, running: request ? isRunning(request.id) : false };
  return (
    <>
      <Nav couple={coupleName(wedding)} />
      <CategoryView slug={category.slug} wedding={wedding} initial={JSON.parse(JSON.stringify(initial))} />
    </>
  );
}
