import { scrapeAllWithProgress, getCacheOrDb, isScraping, subscribeToProgress } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const cached = await getCacheOrDb();

      // Cache is warm (memory or DB) — return immediately
      if (cached) {
        send({ type: "cached", data: cached });
        controller.close();
        return;
      }

      // A scrape is already running (from instrumentation) — subscribe to its progress
      if (isScraping()) {
        send({ type: "start", total: 0 });
        const unsub = subscribeToProgress((event) => {
          if (event.type === "progress") {
            send({ type: "progress", page: event.page, total: event.total });
          } else if (event.type === "done") {
            send({ type: "done", data: event.data });
            unsub();
            controller.close();
          } else if (event.type === "error") {
            send({ type: "error", message: event.message });
            unsub();
            controller.close();
          }
        });
        return;
      }

      // Nothing running and no cache — start a fresh scrape
      send({ type: "start", total: 0 });
      try {
        const data = await scrapeAllWithProgress();
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
