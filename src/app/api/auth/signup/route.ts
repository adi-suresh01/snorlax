import { NextResponse } from "next/server";
import { HttpError, handle } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/repo";

export const POST = handle(async (req: Request) => {
  const { email, password } = await req.json();
  const normalized = String(email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new HttpError(400, "Enter a valid email");
  if (String(password || "").length < 6) throw new HttpError(400, "Password must be at least 6 characters");
  if (await findUserByEmail(normalized)) throw new HttpError(409, "An account with this email already exists");
  const userId = await createUser(normalized, await hashPassword(password));
  await createSession({ userId, email: normalized });
  return NextResponse.json({ ok: true });
});
