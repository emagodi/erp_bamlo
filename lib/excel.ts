// lib/excel.ts
// If this runs in an API route, ensure that route uses the Node runtime:
// export const runtime = 'nodejs';

import * as XLSX from 'xlsx';
import type { WorkBook, WorkSheet } from 'xlsx';
import { prisma } from './db';

// -------- Types --------
export type TakeOffRow = {
  section: 'MATERIALS' | 'LABOUR' | 'OTHER';
  code: string;
  description?: string;
  qty?: number;
  rate?: number;
  factor?: number;
  raw?: Record<string, unknown>;
};

export type ExtractedRule = {
  code: string;
  expression: string;
  description?: string | null;
  dependsOn: string[];
};

// -------- Helpers --------
const CELL_REF_RE = /'[^']+'![A-Z]+\d+|[A-Z]+\d+/g;
const toMinor = (amount: number, scale = 2) =>
  BigInt(Math.round((amount ?? 0) * Math.pow(10, scale)));

function getSheet(wb: WorkBook, name: string): WorkSheet {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet not found: ${name}`);
  return ws;
}

export function readWorkbook(buffer: Buffer): WorkBook {
  return XLSX.read(buffer, { type: 'buffer' });
}

export function sheetToMatrix(ws: WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];
}

// Parse “Take Off” into rows + cell map + formula rules
export function parseTakeOff(
  ws: WorkSheet
): { rows: TakeOffRow[]; cellMap: Record<string, any>; rules: ExtractedRule[] } {
  const matrix = sheetToMatrix(ws);
  let currentSection: TakeOffRow['section'] = 'OTHER';
  const rows: TakeOffRow[] = [];
  const cellMap: Record<string, any> = {};
  const rules: ExtractedRule[] = [];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddress] as any;
      if (!cell) continue;
      if (cell.f) {
        const refs = (cell.f.match(CELL_REF_RE) || []).map((s: string) =>
          s.replace(/^'/, '').replace(/'$/, '')
        );
        rules.push({
          code: `TakeOff!${cellAddress}`,
          expression: cell.f,
          description: null,
          dependsOn: refs,
        });
        cellMap[`TakeOff!${cellAddress}`] = { formula: cell.f };
      } else {
        cellMap[`TakeOff!${cellAddress}`] = cell.v;
      }
    }
  }

  // Heuristic: section headers contain MATERIAL or LABOUR
  for (const row of matrix) {
    const first = (row?.[0] ?? '').toString();
    const line = first.toUpperCase();
    if (line.includes('MATERIAL')) currentSection = 'MATERIALS';
    else if (line.includes('LABOUR')) currentSection = 'LABOUR';

    // Basic mapping: [code, description, qty, rate, factor]
    const code = row?.[0]?.toString?.();
    const description = row?.[1]?.toString?.();
    const qty = Number(row?.[2]);
    const rate = Number(row?.[3]);
    const factor = Number(row?.[4]);

    if (code && description && (Number.isFinite(qty) || Number.isFinite(rate))) {
      rows.push({
        section: currentSection,
        code,
        description,
        qty: Number.isFinite(qty) ? qty : undefined,
        rate: Number.isFinite(rate) ? rate : undefined,
        factor: Number.isFinite(factor) ? factor : undefined,
        raw: { row },
      });
    }
  }

  return { rows, cellMap, rules };
}

export function extractQuoteSheetRefs(ws: WorkSheet): ExtractedRule[] {
  const rules: ExtractedRule[] = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr] as any;
      if (cell?.f) {
        const refs = (cell.f.match(CELL_REF_RE) || []).map((s: string) => s);
        rules.push({ code: `Quote!${addr}`, expression: cell.f, description: null, dependsOn: refs });
      }
    }
  }
  return rules;
}

// Upsert Products + FormulaRules from workbook
export async function upsertFromWorkbook(buffer: Buffer) {
  const wb = readWorkbook(buffer);
  const takeOff = getSheet(wb, 'Take Off');

  // FIX: correct spelling to find your quote sheet
  const quoteSheetName =
    wb.SheetNames.find((n) => n.toUpperCase().includes('MATAVAKWA')) || 'MR AND MRS Matavakwa';
  const quoteWs = wb.Sheets[quoteSheetName];

  const { rows, rules: takeOffRules } = parseTakeOff(takeOff);
  const quoteRules = quoteWs ? extractQuoteSheetRefs(quoteWs) : [];

  // Upsert products — prefer basePriceMinor (BigInt). Fallback to legacy basePrice (String).
  let productsInserted = 0;
  let productsUpdated = 0;

  const writeProduct = async (sku: string, name: string, rateNum: number, extraJson?: string) => {
    try {
      // Try new schema (minor units)
      const dataNew: any = {
        name,
        unit: 'ea',
        basePriceMinor: toMinor(rateNum),
        extraJson: extraJson ?? null,
      };
      const exists = await prisma.product.findUnique({ where: { sku } });
      if (exists) {
        await prisma.product.update({ where: { sku }, data: dataNew });
        productsUpdated++;
      } else {
        await prisma.product.create({ data: { sku, ...dataNew } });
        productsInserted++;
      }
    } catch (e: any) {
      // Fallback to legacy schema with basePrice: String
      const msg = e?.message || '';
      if (msg.includes('Unknown arg `basePriceMinor`') || msg.includes('no such column: basePriceMinor')) {
        const dataOld: any = {
          name,
          unit: 'ea',
          basePrice: rateNum.toString(),
          extraJson: extraJson ?? null,
        };
        const exists = await prisma.product.findUnique({ where: { sku } });
        if (exists) {
          await prisma.product.update({ where: { sku }, data: dataOld });
          productsUpdated++;
        } else {
          await prisma.product.create({ data: { sku, ...dataOld } });
          productsInserted++;
        }
      } else {
        throw e;
      }
    }
  };

  for (const r of rows) {
    const skuPrefix = r.section === 'MATERIALS' ? 'MAT-' : r.section === 'LABOUR' ? 'LAB-' : 'OTH-';
    const sku = skuPrefix + r.code.replace(/\W+/g, '').slice(0, 12);
    const rateNum = Number(r.rate ?? 0);
    const extraJson = r.raw ? JSON.stringify(r.raw) : undefined;
    await writeProduct(sku, r.description || sku, rateNum, extraJson);
  }

  // Upsert formula rules (store dependsOn as JSON string for SQLite String column)
  const allRules = [...takeOffRules, ...quoteRules];
  let rulesInserted = 0;
  let rulesUpdated = 0;
  const preview: { code: string; expression: string; description: string | null; dependsOn: string[] }[] = [];

  for (const rule of allRules) {
    preview.push({ ...rule, description: rule.description || null });
    const existing = await prisma.formulaRule.findUnique({ where: { code: rule.code } });
    const data = {
      expression: rule.expression,
      description: rule.description ?? null,
      dependsOn: JSON.stringify(rule.dependsOn),
    };
    if (existing) {
      await prisma.formulaRule.update({ where: { code: rule.code }, data });
      rulesUpdated++;
    } else {
      await prisma.formulaRule.create({ data: { code: rule.code, ...data } });
      rulesInserted++;
    }
  }

  return { productsInserted, productsUpdated, rulesInserted, rulesUpdated, rulesPreview: preview };
}
