export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scrapeAllWithProgress } = await import("./lib/scraper");

    async function refresh() {
      try {
        console.log("[cron] Starting scheduled scrape…");
        const data = await scrapeAllWithProgress();
        console.log(`[cron] Done — ${data.constituencies.length} constituencies`);
      } catch (e) {
        console.error("[cron] Scrape failed:", e);
      }
    }

    // Initial scrape on server start
    refresh();

    // Then every 5 minutes
    setInterval(refresh, 5 * 60 * 1000);
  }
}
