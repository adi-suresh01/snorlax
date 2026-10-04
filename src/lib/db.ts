import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "./env";

let client: NeonQueryFunction<false, false> | null = null;

/** Lazily-created Neon HTTP client so builds don't need DATABASE_URL. */
export function db(): NeonQueryFunction<false, false> {
  if (!client) client = neon(env.databaseUrl);
  return client;
}
