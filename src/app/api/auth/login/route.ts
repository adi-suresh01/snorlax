import { NextResponse } from "next/server";
import { HttpError, handle } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { findUserByEmail } from "@/lib/repo";

export const POST = handle(async (req: Request) => {
  const { email, password } = await req.json();
  const user = await findUserByEmail(String(email || "").trim().toLowerCase());
  if (!user || !(await verifyPassword(String(password || ""), user.password_hash))) {
    throw new HttpError(401, "Wrong email or password");
  }
  await createSession({ userId: user.id, email: user.email });
  return NextResponse.json({ ok: true });
});
