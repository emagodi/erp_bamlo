
// lib/pdf/reactPdf.tsx
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { prisma } from '@/lib/db';
import QuoteDoc from './QuoteDoc';
import type { PdfRenderer, PdfRequest, PdfResult } from './index';

/** Coerce any DB scalar to a plain number (no BigInt leaks into React-PDF). */
function asNumber(x: unknown, fallback = 0): number {
  if (x == null) return fallback;
  if (typeof x === 'number') return Number.isFinite(x) ? x : fallback;
  if (typeof x === 'bigint') return Number(x);
  if (typeof x === 'string') {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Safe, flat line DTO for PDF (numbers only). */
function toPdfLine(l: any) {
  return {
    id: String(l.id),
    description: String(l.description ?? ''),
    unit: String(l.unit ?? ''),
    quantity: asNumber(l.quantity, 0),
    unitPriceMinor: asNumber(l.unitPriceMinor, 0),
    lineSubtotalMinor: asNumber(l.lineSubtotalMinor, 0),
    lineDiscountMinor: asNumber(l.lineDiscountMinor, 0),
    lineTaxMinor: asNumber(l.lineTaxMinor, 0),
    lineTotalMinor: asNumber(l.lineTotalMinor, 0),
    // stringify meta to avoid objects inside <Text>
    meta: l.metaJson ? String(l.metaJson) : '',
  };
}

/** Safe, flat quote DTO for PDF (no Prisma proxies / BigInt). */
function toPdfQuote(q: any) {
  return {
    id: String(q.id),
    number: q.number ? String(q.number) : null,
    currency: String(q.currency ?? 'USD'),
    vatBps: asNumber(q.vatBps, 0),
    status: String(q.status ?? ''),
    customer: q.customer
      ? { displayName: q.customer.displayName ? String(q.customer.displayName) : '' }
      : null,
    metaJson: q.metaJson ? String(q.metaJson) : '',
    createdAt: q.createdAt instanceof Date ? q.createdAt.toISOString() : String(q.createdAt ?? ''),
    updatedAt: q.updatedAt instanceof Date ? q.updatedAt.toISOString() : String(q.updatedAt ?? ''),
  };
}

export async function renderReactPdf(quoteId: string): Promise<PdfResult> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { customer: true },
  });
  if (!quote) throw new Error('Quote not found');

  const linesRaw = await prisma.quoteLine.findMany({
    where: { quoteId: quote.id },
    orderBy: { createdAt: 'asc' },
  });

  const lines = linesRaw.map(toPdfLine);
  const q = toPdfQuote(quote);

  // Valid React-PDF element
  const element = <QuoteDoc quote={q} lines={lines} />;

  // in lib/pdf/reactPdf.tsx, right before calling pdf(element):
  const test = (
    <Document>
      <Page>
        <Text>OK</Text>
      </Page>
    </Document>
  );
  

  // Return Buffer as required by PdfResult
 // const instance = pdf(element);
  const buffer = await pdf(test).toBuffer(); // if this succeeds, QuoteDoc has invalid children /* await instance.toBuffer(); */
  const filename = `${q.number || q.id}.pdf`;

  return { buffer, filename };
}

// Class export so getPdfRenderer() can `new ReactPdfRenderer()`
export class ReactPdfRenderer implements PdfRenderer {
  async render(req: PdfRequest): Promise<PdfResult> {
    return renderReactPdf(req.quoteId);
  }
}
