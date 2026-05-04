import { scrapeAllWithProgress, getCache } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  const SCRAPE_INTERVAL = 5 * 60 * 1000;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const cached = getCache();
      const now = Date.now();
      const age = cached ? now - new Date(cached.fetchedAt).getTime() : Infinity;

      if (cached && age < SCRAPE_INTERVAL) {
        send({ type: "cached", data: cached });
        controller.close();
        return;
      }

      send({ type: "start", total: 0 }); // total unknown until page 1 is scraped

      try {
        const data = await scrapeAllWithProgress((page, total) => {
          send({ type: "progress", page, total });
        });
        send({ type: "done", data });
      } catch (e) {
        send({ type: "error", message: String(e) });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
