import { NextResponse } from "next/server";
import { handle, requireApiSession } from "@/lib/api";
import { checkReplies } from "@/lib/pipeline";

/** Manual "Check replies" trigger — same work the background poller does. */
export const POST = handle(async () => {
  await requireApiSession();
  const handled = await checkReplies();
  return NextResponse.json({ handled });
});
