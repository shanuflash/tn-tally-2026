const STOP_AT = new Date("2026-05-05T00:00:00+05:30").getTime();

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scrapeAllWithProgress } = await import("./lib/scraper");

    async function refresh() {
      if (Date.now() >= STOP_AT) {
        console.log("[cron] Past May 5 — scraping stopped.");
        return;
      }
      try {
        console.log("[cron] Starting scheduled scrape…");
        const data = await scrapeAllWithProgress();
        console.log(`[cron] Done — ${data.constituencies.length} constituencies`);
      } catch (e) {
        console.error("[cron] Scrape failed:", e);
      }
    }

    // Only start if we haven't passed the cutoff
    if (Date.now() < STOP_AT) {
      refresh();
      setInterval(refresh, 2 * 60 * 1000);
    } else {
      console.log("[cron] Past May 5 — scraping disabled.");
    }
  }
}
