import { NextResponse } from "next/server";
import { getResults } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  const freshData = await getResults(false);
  if (freshData) return NextResponse.json(freshData);

  const staleData = await getResults(true);
  if (staleData) return NextResponse.json({ ...staleData, isStale: true });

  return NextResponse.json({ error: "No data yet" }, { status: 503 });
}
