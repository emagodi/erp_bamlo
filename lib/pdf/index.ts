// export type PdfEngine = 'react-pdf' | 'puppeteer';

// export interface PdfRequest {
//   quoteId: string;
//   template?: 'Classic' | 'Compact';
// }

// export interface PdfResult {
//   buffer: Buffer;
//   filename: string;
// }

// export interface PdfRenderer {
//   render(req: PdfRequest): Promise<PdfResult>;
// }

// export async function getPdfRenderer(): Promise<PdfRenderer> {
//   const engine = (process.env.PDF_ENGINE as PdfEngine) || 'react-pdf';
//   if (engine === 'puppeteer') {
//     const mod = await import('./puppeteer');
//     return new mod.PuppeteerRenderer();
//   }
//   const mod = await import('./reactPdf');
//   return new mod.ReactPdfRenderer();
// }



// lib/pdf/index.ts
export type PdfEngine = 'react-pdf' | 'puppeteer';

export interface PdfRequest { quoteId: string; template?: 'Classic' | 'Compact' }
export interface PdfResult { buffer: Buffer; filename: string }
export interface PdfRenderer { render(req: PdfRequest): Promise<PdfResult> }

export async function getPdfRenderer(): Promise<PdfRenderer> {
  const engine = (process.env.PDF_ENGINE as PdfEngine) || 'react-pdf';

  if (engine === 'puppeteer') {
    const mod = await import('./puppeteer');
    return new mod.PuppeteerRenderer();
  }

  // ✅ no `new` — just wrap the function we export from reactPdf.tsx
  const mod = await import('./reactPdf'); // must export `renderReactPdf`
  return {
    async render(req) {
      return mod.renderReactPdf(req.quoteId);
    },
  };
}
