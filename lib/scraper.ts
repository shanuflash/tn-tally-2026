import { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import * as cheerio from "cheerio";

const IS_PROD = process.env.NODE_ENV === "production";

export interface ConstituencyResult {
  constituency: string;
  constNo: number;
  leadingCandidate: string;
  leadingParty: string;
  trailingCandidate: string;
  trailingParty: string;
  margin: number;
  round: string;
  status: string;
}

export interface ScraperCache {
  constituencies: ConstituencyResult[];
  fetchedAt: string;
  totalPages: number;
}

let cache: ScraperCache | null = null;
let isFetching = false;
// Resolvers waiting for the current in-progress scrape to finish
let fetchWaiters: Array<(result: ScraperCache) => void> = [];

const BASE_URL = "https://results.eci.gov.in/ResultAcGenMay2026/statewiseS22";

function parsePage(html: string): ConstituencyResult[] {
  const $ = cheerio.load(html);
  const results: ConstituencyResult[] = [];

  const getText = (cell: ReturnType<typeof $>) =>
    cell.clone().find("table").remove().end().text().trim();

  const getPartyText = (cell: ReturnType<typeof $>) =>
    cell.find("table td").first().text().trim();

  $("table.table-striped.table-bordered tbody tr").each((_, row) => {
    const cells = $(row).children("td");
    if (cells.length < 8) return;

    const constituency = getText($(cells[0]));
    if (!constituency) return;

    const constNo = parseInt($(cells[1]).text().trim());
    if (!constNo) return;

    const leadingCandidate = getText($(cells[2]));
    const leadingParty = getPartyText($(cells[3]));
    const trailingCandidate = getText($(cells[4]));
    const trailingParty = getPartyText($(cells[5]));
    const margin = parseInt($(cells[6]).text().trim().replace(/,/g, "")) || 0;
    const round = getText($(cells[7]));
    const status = cells.length >= 9 ? getText($(cells[8])) : "";

    results.push({ constituency, constNo, leadingCandidate, leadingParty, trailingCandidate, trailingParty, margin, round, status });
  });

  return results;
}

function parseTotalPages(html: string): number {
  const $ = cheerio.load(html);
  const count = $("ul.pagination.pagination-sm li").length;
  return count > 0 ? count : 12;
}

async function scrapePageContent(
  browser: Browser,
  pageNum: number
): Promise<{ rows: ConstituencyResult[]; html: string }> {
  const url = `${BASE_URL}${pageNum}.htm`;
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ Referer: "https://results.eci.gov.in/" });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const html = await page.content();
    return { rows: parsePage(html), html };
  } catch (e) {
    console.error(`[scraper] Failed page ${pageNum}:`, e);
    return { rows: [], html: "" };
  } finally {
    await page.close();
  }
}

export async function scrapeAllWithProgress(
  onProgress?: (page: number, total: number) => void
): Promise<ScraperCache> {
  // If already fetching, wait for it to finish instead of returning stale/empty
  if (isFetching) {
    return new Promise((resolve) => {
      fetchWaiters.push(resolve);
    });
  }

  isFetching = true;

  let browser: Browser | null = null;
  try {
    if (IS_PROD) {
      const puppeteerCore = await import("puppeteer-core");
      browser = await puppeteerCore.default.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      const puppeteer = await import("puppeteer");
      browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    const { rows: firstRows, html: firstHtml } = await scrapePageContent(browser, 1);
    const totalPages = parseTotalPages(firstHtml);
    console.log(`[scraper] Detected ${totalPages} pages from pagination.`);

    onProgress?.(1, totalPages);
    const all: ConstituencyResult[] = [...firstRows];

    for (let i = 2; i <= totalPages; i++) {
      console.log(`[scraper] Page ${i}/${totalPages}`);
      const { rows } = await scrapePageContent(browser, i);
      all.push(...rows);
      onProgress?.(i, totalPages);
      await new Promise((r) => setTimeout(r, 800));
    }

    cache = {
      constituencies: all,
      fetchedAt: new Date().toISOString(),
      totalPages,
    };

    console.log(`[scraper] Done. ${all.length} constituencies across ${totalPages} pages.`);
  } finally {
    await browser?.close();
    isFetching = false;
    // Notify all waiters
    const waiters = fetchWaiters;
    fetchWaiters = [];
    for (const resolve of waiters) resolve(cache!);
  }

  return cache!;
}

export async function scrapeAll(): Promise<ScraperCache> {
  return scrapeAllWithProgress();
}

export function getCache(): ScraperCache | null {
  return cache;
}
