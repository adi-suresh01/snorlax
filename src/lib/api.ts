import { NextResponse } from "next/server";
import { getSession, type Session } from "./auth";
import { getWeddingByUser } from "./repo";
import type { Wedding } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireApiSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Not signed in");
  return session;
}

export async function requireApiWedding(): Promise<{ session: Session; wedding: Wedding }> {
  const session = await requireApiSession();
  const wedding = await getWeddingByUser(session.userId);
  if (!wedding) throw new HttpError(409, "Fill in your wedding profile first");
  return { session, wedding };
}

/** Wrap a route handler so thrown HttpErrors become JSON error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error(err);
      return NextResponse.json({ error: (err as Error).message || "Server error" }, { status: 500 });
    }
  };
}
