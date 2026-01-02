/* "use server";
import { evaluateAll } from '@/lib/ruleEngine';
import { prisma } from '@/lib/db';
import { money } from '@/lib/money';
import { calcLine, subtotal, discount as discountFn, netBeforeTax, tax, grandTotal } from '@/lib/formulas';

export async function computeAutoQuote(baseInputs: Record<string, number>) {
  const { evaluated } = await evaluateAll(baseInputs);
  // Expose all computed values; in a real mapping you might filter by codes relevant for quote lines
  const values = evaluated.map((e) => ({ code: e.code, value: e.value }));
  return { values };
}

export async function createAutoQuote(input: { baseInputs: Record<string, number>; include: { code: string; value: number }[] }) {
  // Create a temporary customer if none exists
  const customer = await prisma.customer.findFirst();
  const customerId = customer?.id || (await prisma.customer.create({ data: { displayName: 'Walk-in Customer' } })).id;
  const vatRate = parseFloat(process.env.VAT_DEFAULT || '0.15');
  const currency = process.env.NEXT_PUBLIC_CURRENCY || 'USD';

  // Turn selected computed values into simple lines (description=code, unitPrice=value for demo)
  // In a real setup you would map codes -> product + unit price lookup.
  const linesCalced = input.include.map((i) => calcLine({ qty: 1, unitPrice: money(i.value), vatRate }));
  const sub = subtotal(linesCalced);
  const disc = discountFn(sub, 'none');
  const net = netBeforeTax(sub, disc);
  const t = tax(net, vatRate);
  const g = grandTotal(net, t);

  const quote = await prisma.quote.create({
    data: {
      customerId,
      currency,
      vatRate: vatRate.toString() as any,
      discountPolicy: 'none',
      metaJson: JSON.stringify({ baseInputs: input.baseInputs }),
      lines: {
        create: input.include.map((i, idx) => ({
          description: i.code,
          quantity: '1',
          unitPrice: i.value.toString(),
          lineSubtotal: linesCalced[idx].lineSubtotal.toString(),
          lineDiscount: linesCalced[idx].lineDiscount.toString(),
          lineTax: linesCalced[idx].lineTax.toString(),
          lineTotal: linesCalced[idx].lineTotal.toString(),
        })),
      },
    },
  });
  return { quoteId: quote.id };
}

 */

"use server";

import { evaluateAll } from "@/lib/ruleEngine";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import {
  calcLine,
  subtotal,
  discount as discountFn,
  netBeforeTax,
  tax,
  grandTotal,
} from "@/lib/formulas";

// helpers (or import from your shared helpers)
const toMinor = (amount: number, scale = 2): bigint =>
  BigInt(Math.round((amount ?? 0) * Math.pow(10, scale)));
const toBps = (pct: number) => Math.round((pct ?? 0) * 100); // 15.00 -> 1500
const parseVatEnvToPercent = (raw: string | undefined) => {
  const n = Number(raw ?? "0.15"); // supports "0.1500" or "15"
  return n <= 1 ? n * 100 : n;
};

async function ensureSystemUserId() {
  const email = "system@local";
  const u = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "System", role: "ADMIN" },
  });
  return u.id;
}

export async function computeAutoQuote(baseInputs: Record<string, number>) {
  const { evaluated } = await evaluateAll(baseInputs);
  const values = evaluated.map((e) => ({ code: e.code, value: e.value }));
  return { values };
}

export async function createAutoQuote(input: {
  baseInputs: Record<string, number>;
  include: { code: string; value: number; unit?: string }[];
  customerId?: string;
  vatRate?: number;            // optional override in %
  currency?: string;
}) {
  // ensure customer
  let customerId = input.customerId;
  if (!customerId) {
    const existing = await prisma.customer.findFirst();
    customerId =
      existing?.id ||
      (
        await prisma.customer.create({
          data: { displayName: "Walk-in Customer" },
        })
      ).id;
  }

  const userId = await ensureSystemUserId();

  // VAT: env default is "0.1500" -> 15%; accept override
  const vatPct =
    typeof input.vatRate === "number"
      ? input.vatRate
      : parseVatEnvToPercent(process.env.VAT_DEFAULT);
  const currency = input.currency || process.env.NEXT_PUBLIC_CURRENCY || "USD";

  // Calculate in display units for totals
  const linesCalced = input.include.map((i) =>
    calcLine({ qty: 1, unitPrice: money(i.value), vatRate: vatPct })
  );
  const sub = subtotal(linesCalced);
  const disc = discountFn(sub, "none");
  const net = netBeforeTax(sub, disc);
  const t = tax(net, vatPct);
  const g = grandTotal(net, t);

  // Build Prisma payload using MINOR units + nested relations
  const quote = await prisma.quote.create({
    data: {
      currency,
      vatBps: toBps(vatPct), // 15 -> 1500
      discountPolicy: "none",
      metaJson: JSON.stringify({
        baseInputs: input.baseInputs,
        totalsPreview: {
          subtotal: Number(sub),
          discount: Number(disc),
          net: Number(net),
          tax: Number(t),
          grandTotal: Number(g),
        },
      }),
      createdBy: { connect: { id: userId } },
      customer: { connect: { id: customerId } },

      lines: {
        create: input.include.map((i, idx) => {
          const c = linesCalced[idx];
          const qty = 1;
          const price = Number(i.value ?? 0);
          return {
            description: i.code,
            unit: i.unit ?? null, // keep if your schema has `unit String?`
            quantity: qty, // Float, number (not string)

            // Money in MINOR UNITS (BigInt)
            unitPriceMinor: toMinor(price),
            lineSubtotalMinor: toMinor(Number(c.lineSubtotal)),
            lineDiscountMinor: toMinor(Number(c.lineDiscount)),
            lineTaxMinor: toMinor(Number(c.lineTax)),
            lineTotalMinor: toMinor(Number(c.lineTotal)),

            metaJson: JSON.stringify({
              code: i.code,
              unit: i.unit ?? "",
              source: "autoQuote",
            }),
          };
        }),
      },
    },
  });

  return { quoteId: quote.id };
}
