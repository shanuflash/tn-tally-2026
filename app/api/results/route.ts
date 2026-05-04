import { NextResponse } from "next/server";
import { getResults } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getResults();
  if (!data) return NextResponse.json({ error: "No data yet" }, { status: 503 });
  return NextResponse.json(data);
}
