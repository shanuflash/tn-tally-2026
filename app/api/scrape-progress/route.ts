import { scrape, getResults, isScraping, subscribeToProgress } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const cached = await getResults();
      if (cached) {
        send({ type: "cached", data: cached });
        controller.close();
        return;
      }

      send({ type: "start", total: 0 });

      if (isScraping()) {
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

      try {
        const data = await scrape();
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
