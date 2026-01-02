// lib/pdf/puppeteer.ts
import chromium from "@sparticuz/chromium";
import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import type { PdfRenderer, PdfRequest, PdfResult } from "./index";
import { prisma } from "@/lib/db";

function money(minor: number, cur = "USD") {
  return `${cur === "USD" ? "US$" : ""}${(Number(minor || 0) / 100).toFixed(2)}`;
}

export class PuppeteerRenderer implements PdfRenderer {
  async render(req: PdfRequest): Promise<PdfResult> {
    // Load data (same sanitization idea)
    const quote = await prisma.quote.findUnique({
      where: { id: req.quoteId },
      include: { customer: true, lines: { orderBy: { id: "asc" } } },
    });
    if (!quote) throw new Error("Quote not found");

    const vatPct = Number(quote.vatBps ?? 0) / 100;
    const currency = quote.currency ?? "USD";

    // Minimal HTML template (server-safe, no client React involved)
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Quote ${quote.number || quote.id}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;margin:24px}
    h1{font-size:20px;margin:0 0 4px} .muted{color:#666}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
    th,td{border-bottom:1px solid #eee;padding:6px;text-align:left}
    th{text-align:left;background:#f7f7f7}
    tfoot td{font-weight:700;background:#fafafa}
    .right{text-align:right}
    .badge{display:inline-block;padding:2px 8px;border-radius:12px;background:#eef;border:1px solid #ccd;font-size:11px}
  </style>
</head>
<body>
  <h1>Quote ${quote.number || `#${quote.id.slice(0,6)}`}</h1>
  <div class="muted">Customer: ${quote.customer?.displayName ?? ""}</div>
  <div class="muted">VAT: ${vatPct.toFixed(2)}%</div>
  <div class="muted">Status: <span class="badge">${quote.status}</span></div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Description</th>
        <th style="width:70px">Unit</th>
        <th style="width:90px" class="right">Qty</th>
        <th style="width:120px" class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${quote.lines
        .map((l, i) => {
          const qty = Number(l.quantity || 0);
          const amt = Number(l.lineTotalMinor || 0);
          const unit = l.unit ?? "";
          const desc = (l.description ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          return `<tr>
            <td>${i + 1}</td>
            <td>${desc}</td>
            <td>${unit}</td>
            <td class="right">${qty.toFixed(3)}</td>
            <td class="right">${money(amt, currency)}</td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>
</body>
</html>`;

    // Launch Chromium (works locally & on Vercel)
    const isServerless = !!process.env.VERCEL;
    const executablePath = isServerless
      ? await chromium.executablePath()
      : process.env.CHROME_EXECUTABLE_PATH; // optional for local full Chrome

    const browser: Browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      headless: "new",
      executablePath,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "12mm", left: "10mm" },
      });

      const filename = `${quote.number || quote.id}.pdf`;
      return { buffer, filename };
    } finally {
      await browser.close();
    }
  }
}
