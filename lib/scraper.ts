import { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import * as cheerio from "cheerio";
import { saveToDb, loadFromDb } from "./db";

const IS_PROD = process.env.NODE_ENV === "production";
const BASE_URL = "https://results.eci.gov.in/ResultAcGenMay2026/statewiseS22";

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

type ProgressEvent =
  | { type: "progress"; page: number; total: number }
  | { type: "done"; data: ScraperCache }
  | { type: "error"; message: string };

let progressListeners: Array<(event: ProgressEvent) => void> = [];

export function subscribeToProgress(cb: (event: ProgressEvent) => void): () => void {
  progressListeners.push(cb);
  return () => { progressListeners = progressListeners.filter((l) => l !== cb); };
}

export function isScraping(): boolean {
  return isFetching;
}

function emit(event: ProgressEvent) {
  for (const cb of progressListeners) cb(event);
}

function parsePage(html: string): ConstituencyResult[] {
  const $ = cheerio.load(html);
  const results: ConstituencyResult[] = [];

  const getText = (cell: ReturnType<typeof $>) =>
    cell.clone().find("table").remove().end().text().trim();
  const getParty = (cell: ReturnType<typeof $>) =>
    cell.find("table td").first().text().trim();

  $("table.table-striped.table-bordered tbody tr").each((_, row) => {
    const cells = $(row).children("td");
    if (cells.length < 8) return;
    const constituency = getText($(cells[0]));
    if (!constituency) return;
    const constNo = parseInt($(cells[1]).text().trim());
    if (!constNo) return;
    results.push({
      constituency,
      constNo,
      leadingCandidate: getText($(cells[2])),
      leadingParty: getParty($(cells[3])),
      trailingCandidate: getText($(cells[4])),
      trailingParty: getParty($(cells[5])),
      margin: parseInt($(cells[6]).text().trim().replace(/,/g, "")) || 0,
      round: getText($(cells[7])),
      status: cells.length >= 9 ? getText($(cells[8])) : "",
    });
  });

  return results;
}

function parseTotalPages(html: string): number {
  const $ = cheerio.load(html);
  const count = $("ul.pagination.pagination-sm li").length;
  return count > 0 ? count : 12;
}

async function scrapePage(browser: Browser, pageNum: number): Promise<{ rows: ConstituencyResult[]; html: string }> {
  const page = await browser.newPage();
  try {
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    await page.setExtraHTTPHeaders({ Referer: "https://results.eci.gov.in/" });
    await page.goto(`${BASE_URL}${pageNum}.htm`, { waitUntil: "networkidle2", timeout: 30000 });
    const html = await page.content();
    return { rows: parsePage(html), html };
  } catch (e) {
    console.error(`[scraper] Failed page ${pageNum}:`, e);
    return { rows: [], html: "" };
  } finally {
    await page.close();
  }
}

export async function scrape(): Promise<ScraperCache> {
  if (isFetching) {
    return new Promise((resolve, reject) => {
      const unsub = subscribeToProgress((event) => {
        if (event.type === "done") { unsub(); resolve(event.data); }
        else if (event.type === "error") { unsub(); reject(new Error(event.message)); }
      });
    });
  }

  isFetching = true;
  let browser: Browser | null = null;

  try {
    if (IS_PROD) {
      const { default: puppeteer } = await import("puppeteer-core");
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      const { default: puppeteer } = await import("puppeteer");
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    const { rows: firstRows, html: firstHtml } = await scrapePage(browser, 1);
    const totalPages = parseTotalPages(firstHtml);
    console.log(`[scraper] ${totalPages} pages detected`);

    const all: ConstituencyResult[] = [...firstRows];
    emit({ type: "progress", page: 1, total: totalPages });

    for (let i = 2; i <= totalPages; i++) {
      const { rows } = await scrapePage(browser, i);
      all.push(...rows);
      emit({ type: "progress", page: i, total: totalPages });
      await new Promise((r) => setTimeout(r, 800));
    }

    cache = { constituencies: all, fetchedAt: new Date().toISOString(), totalPages };
    console.log(`[scraper] Done — ${all.length} constituencies`);
    saveToDb(cache).catch((e) => console.error("[db] Save failed:", e));
    emit({ type: "done", data: cache });
  } catch (e) {
    emit({ type: "error", message: String(e) });
    throw e;
  } finally {
    await browser?.close();
    isFetching = false;
  }

  return cache!;
}

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function isCacheFresh(c: ScraperCache): boolean {
  return Date.now() - new Date(c.fetchedAt).getTime() < CACHE_TTL_MS;
}

export async function getResults(includeStale = false): Promise<ScraperCache | null> {
  if (!cache) {
    const dbData = await loadFromDb();
    if (dbData) {
      cache = dbData;
      console.log("[db] Seeded cache from Turso");
    }
  }

  if (cache) {
    if (isCacheFresh(cache) || includeStale) {
      return cache;
    }
  }

  return null; // caller triggers fresh scrape
}
