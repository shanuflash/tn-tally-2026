import { NextResponse } from "next/server";
import { getCacheOrDb } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = await getCacheOrDb();
  if (!cached) {
    return NextResponse.json({ error: "No data yet" }, { status: 503 });
  }
  return NextResponse.json(cached);
}
