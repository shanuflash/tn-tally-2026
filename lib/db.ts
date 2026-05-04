import { createClient } from "@libsql/client";
import type { ScraperCache } from "./scraper";

function getClient() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) return null;
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export async function saveToDb(data: ScraperCache) {
  const client = getClient();
  if (!client) return;
  await client.execute(`CREATE TABLE IF NOT EXISTS cache (
    id INTEGER PRIMARY KEY, data TEXT NOT NULL, fetched_at TEXT NOT NULL
  )`);
  await client.execute({
    sql: `INSERT INTO cache (id, data, fetched_at) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
    args: [JSON.stringify(data), data.fetchedAt],
  });
}

export async function loadFromDb(): Promise<ScraperCache | null> {
  const client = getClient();
  if (!client) return null;
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS cache (
      id INTEGER PRIMARY KEY, data TEXT NOT NULL, fetched_at TEXT NOT NULL
    )`);
    const result = await client.execute(`SELECT data FROM cache WHERE id = 1`);
    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows[0].data as string) as ScraperCache;
  } catch {
    return null;
  }
}
