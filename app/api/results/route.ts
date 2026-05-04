import { NextResponse } from "next/server";
import { getResults } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function withNoCache(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export async function GET() {
  const freshData = await getResults(false);
  if (freshData) return withNoCache(NextResponse.json(freshData));

  const staleData = await getResults(true);
  if (staleData) return withNoCache(NextResponse.json({ ...staleData, isStale: true }));

  return withNoCache(NextResponse.json({ error: "No data yet" }, { status: 503 }));
}
