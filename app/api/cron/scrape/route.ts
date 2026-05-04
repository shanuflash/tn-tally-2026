import { scrapeAllWithProgress } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const data = await scrapeAllWithProgress();
    return Response.json({ ok: true, constituencies: data.constituencies.length, fetchedAt: data.fetchedAt });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
