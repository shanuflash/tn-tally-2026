import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

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

const BASE_URL = "https://results.eci.gov.in/ResultAcGenMay2026/statewiseS22";

function parsePage(html: string): ConstituencyResult[] {
  const $ = cheerio.load(html);
  const results: ConstituencyResult[] = [];

  // Strip nested tables from a cell before reading text
  const getText = (cell: ReturnType<typeof $>) =>
    cell.clone().find("table").remove().end().text().trim();

  // Party name is in the first <td> of the nested table inside the cell
  const getPartyText = (cell: ReturnType<typeof $>) =>
    cell.find("table td").first().text().trim();

  $("table.table-striped.table-bordered tbody tr").each((_, row) => {
    // Direct children only — avoids rows from nested tooltip tables inside cells
    const cells = $(row).children("td");
    if (cells.length < 8) return;

    const constituency = getText($(cells[0]));
    if (!constituency) return;

    const constNo = parseInt($(cells[1]).text().trim());
    // Real constituency rows always have a numeric const number
    if (!constNo) return;

    const leadingCandidate = getText($(cells[2]));
    const leadingParty = getPartyText($(cells[3]));
    const trailingCandidate = getText($(cells[4]));
    const trailingParty = getPartyText($(cells[5]));
    const margin = parseInt($(cells[6]).text().trim().replace(/,/g, "")) || 0;
    const round = getText($(cells[7]));
    const status = cells.length >= 9 ? getText($(cells[8])) : "";

    results.push({
      constituency,
      constNo,
      leadingCandidate,
      leadingParty,
      trailingCandidate,
      trailingParty,
      margin,
      round,
      status,
    });
  });

  return results;
}

function parseTotalPages(html: string): number {
  const $ = cheerio.load(html);
  // Count <li> children inside ul.pagination.pagination-sm
  const count = $("ul.pagination.pagination-sm li").length;
  return count > 0 ? count : 12; // fallback to 12
}

async function scrapePageContent(
  browser: puppeteer.Browser,
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
  if (isFetching) {
    return cache ?? { constituencies: [], fetchedAt: new Date().toISOString(), totalPages: 12 };
  }

  isFetching = true;

  let browser: puppeteer.Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    // Scrape page 1 first to get the dynamic total page count
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
  }

  return cache!;
}

export async function scrapeAll(): Promise<ScraperCache> {
  return scrapeAllWithProgress();
}

export function getCache(): ScraperCache | null {
  return cache;
}
