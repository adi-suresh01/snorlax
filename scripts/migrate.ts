import "dotenv/config";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing in .env");
  const sql = neon(url);
  const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) await sql.query(stmt);
  console.log(`migrated (${statements.length} statements)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
