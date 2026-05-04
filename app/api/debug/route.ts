import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = "https://results.eci.gov.in/ResultAcGenMay2026/statewiseS221.htm";
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ Referer: "https://results.eci.gov.in/" });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const html = await page.content();
    const $ = cheerio.load(html);

    // Count rows with different selectors
    const allTableRows = $("table tr").length;
    const stripedRows = $("table.table-striped tr").length;
    const borderedRows = $("table.table-bordered tr").length;
    const bothRows = $("table.table-striped.table-bordered tr").length;
    const tbodyRows = $("table.table-striped.table-bordered tbody tr").length;
    const allTbodyRows = $("tbody tr").length;

    // List all table classes
    const tables: string[] = [];
    $("table").each((_, t) => {
      tables.push($(t).attr("class") || "(no class)");
    });

    const getText = (cell: ReturnType<typeof $>) =>
      cell.clone().find("table").remove().end().text().trim();
    const getPartyText = (cell: ReturnType<typeof $>) =>
      cell.find("table td").first().text().trim();

    // Parse using the fixed logic
    const parsed: object[] = [];
    $("table.table-striped.table-bordered tbody tr").each((_, row) => {
      const cells = $(row).children("td");
      if (cells.length < 8) return;
      const constituency = getText($(cells[0]));
      if (!constituency) return;
      const constNo = parseInt($(cells[1]).text().trim());
      if (!constNo) return;
      parsed.push({
        constituency,
        constNo,
        leadingCandidate: getText($(cells[2])),
        leadingParty: getPartyText($(cells[3])),
        trailingCandidate: getText($(cells[4])),
        trailingParty: getPartyText($(cells[5])),
        margin: parseInt($(cells[6]).text().trim().replace(/,/g, "")) || 0,
        round: getText($(cells[7])),
        status: cells.length >= 9 ? getText($(cells[8])) : "",
      });
    });

    // Raw HTML of cells 3 and 5 from first real row
    let cell3Html = "";
    let cell5Html = "";
    $("table.table-striped.table-bordered tbody tr").each((_, row) => {
      if (cell3Html) return;
      const cells = $(row).children("td");
      if (cells.length < 8) return;
      const constNo = parseInt($(cells[1]).text().trim());
      if (!constNo) return;
      cell3Html = $(cells[3]).html() || "";
      cell5Html = $(cells[5]).html() || "";
    });

    return NextResponse.json({
      totalRowsFound: parsed.length,
      first5: parsed.slice(0, 5),
      cell3Html,
      cell5Html,
    });
  } finally {
    await browser?.close();
  }
}
