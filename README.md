# Quotation Generator (Next.js 15, TypeScript)

Production-ready quotation app that imports Excel logic, mirrors Excel formulas safely, and renders PDF quotations. Built with Next.js App Router, Tailwind, Prisma, and Zod.

## Stack

- Next.js 15 (App Router + Server Actions)
- TypeScript, Zod validation
- Tailwind CSS (shadcn/ui compatible)
- Prisma ORM (SQLite dev, Postgres prod)
- Excel parsing via `xlsx`
- PDF via `@react-pdf/renderer` (default) or optional Puppeteer
- Tests: Vitest (unit), Playwright (e2e)

## Getting Started

1. Copy env and install deps

```
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

2. Visit

- Import API: POST `/api/import` (multipart form with `file`=.xlsx)
- New Quote: `/quotes/new`

## Excel Import

- Expected workbook name: `exc.xlsx`
- Data sheet: `Take Off`
- Quote sheet: `MR AND MRS Matavakwa` (or any sheet containing `Matavakwa`)

The importer:

- Parses `Take Off` into product-like rows with heuristic columns `[code, description, qty, rate, factor]`.
- Extracts formulas from both sheets as `FormulaRule` rows. Dependencies inferred from cell refs.
- Upserts `Product` by synthesized SKU (`MAT-`, `LAB-`, or `OTH-` + code).

Adjust column mapping if the sheet structure changes: edit `lib/excel.ts` in `parseTakeOff()` where the mapping `[0..4]` is applied.

## Formula Mirroring

Pure, money-safe functions live in `lib/formulas.ts`. Examples mirrored from Excel:

- `sum2(a,b)`, `sumN(...vals)`
- `applyFactor(x, factor)`
- `multiply3(a, b, c)`
- `divide(a, b)`
- `identity(x)`
- `lineTotal(unit, qty)`
- Quote engine: `calcLine()`, `subtotal()`, `discount()`, `netBeforeTax()`, `tax()`, `grandTotal()`

A whitelisted expression evaluator using `expr-eval` is available through `evaluateExpression()` with only approved math ops and helper functions.

## Numbering & Versioning

- Numbers: `QTN-YYYYMM-####` via `lib/numbering.ts`.
- Finalize creates a `QuoteVersion` snapshot including serialized totals and `pdfBase64`.

## PDF / Print

- Default: React PDF (`lib/pdf/reactPdf.tsx`)
- Optional: Puppeteer (`lib/pdf/puppeteer.ts`) — implement real HTML→PDF if desired.
- Switch via `PDF_ENGINE` in `.env`.

## Server Actions

- `createQuote(input)` — creates draft with server-side recalcs.
- `finalizeQuote(quoteId)` — assigns number, regenerates totals and PDF, saves `QuoteVersion`.

## Testing

- Unit (Vitest): `npm test` — covers formula functions in `tests/formulas.spec.ts`.
- e2e (Playwright): `npm run e2e` — placeholder flow; start dev server automatically.

## Production Notes

- Switch Prisma datasource to Postgres in `prisma/schema.prisma` and set `DATABASE_URL`.
- Add rate limiting and auth around `/api/import` and server actions.
- Replace Puppeteer stub with a real implementation if selecting that engine.
- Integrate shadcn/ui components for richer, accessible UI (current UI is minimal Tailwind to keep bootstrap simple).

