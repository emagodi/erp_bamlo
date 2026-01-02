//@ts-nocheck

import { Parser } from 'expr-eval';
import Decimal from 'decimal.js-light';
import { money, Money, roundMoney } from './money';

// Basic Money-safe helpers mirroring Excel samples
export function sum2(a: Money, b: Money): Money {
  return a.add(b);
}

export function sumN(...vals: Money[]): Money {
  return vals.reduce((acc, v) => acc.add(v), money(0));
}

export function applyFactor(x: Money, factor: number): Money {
  return x.mul(factor);
}

export function multiply3(a: Money, b: number, c: number): Money {
  return a.mul(b).mul(c);
}

export function divide(a: Money, b: number): Money {
  return a.div(b);
}

export function identity<T>(x: T): T {
  return x;
}

export function lineTotal(unit: Money, qty: number): Money {
  return unit.mul(qty);
}

export type LineInput = {
  qty: number;
  unitPrice: Money;
  discount?: { type: 'percent' | 'fixed'; value: number } | null;
  vatRate?: number; // e.g., 0.15
};

export type LineCalc = {
  lineSubtotal: Money;
  lineDiscount: Money;
  lineTax: Money;
  lineTotal: Money;
};

export function calcLine(input: LineInput): LineCalc {
  const subtotal = lineTotal(input.unitPrice, input.qty);
  let discount = money(0);
  if (input.discount) {
    if (input.discount.type === 'percent') {
      discount = subtotal.mul(input.discount.value / 100);
    } else {
      discount = money(input.discount.value);
    }
  }
  const net = subtotal.sub(discount);
  const vatRate = input.vatRate ?? Number(process.env.VAT_DEFAULT ?? 0);
  const tax = /* net.mul(vatRate); */ 0;
  const total = net.add(tax);
  return {
    lineSubtotal: roundMoney(subtotal),
    lineDiscount: roundMoney(discount),
    lineTax: roundMoney(tax),
    lineTotal: roundMoney(total),
  };
}

export function subtotal(lines: LineCalc[]): Money {
  return roundMoney(lines.reduce((acc, l) => acc.add(l.lineSubtotal), money(0)));
}

export function discount(total: Money, policy: string | null): Money {
  if (!policy || policy === 'none') return money(0);
  // Simple example: bulk policy gives 5%
  if (policy === 'bulk') return roundMoney(total.mul(0.05));
  return money(0);
}

export function netBeforeTax(total: Money, discountVal: Money): Money {
  return roundMoney(total.sub(discountVal));
}

export function tax(net: Money, vatRate: number): Money {
  return roundMoney(net.mul(vatRate));
}

export function grandTotal(net: Money, taxVal: Money): Money {
  return roundMoney(net.add(taxVal));
}

// Expression evaluator with whitelist context
const parser = new Parser({ allowMemberAccess: false });

export type EvalContext = Record<string, number> & {
  // Functions exposed to evaluator
  sum2?: (a: number, b: number) => number;
  sumN?: (...vals: number[]) => number;
  applyFactor?: (x: number, factor: number) => number;
  multiply3?: (a: number, b: number, c: number) => number;
  divide?: (a: number, b: number) => number;
  identity?: (x: number) => number;
  lineTotal?: (unit: number, qty: number) => number;
};

export const builtinFns: Required<Omit<EvalContext, keyof Record<string, number>>> = {
  sum2: (a, b) => new Decimal(a).add(b).toNumber(),
  sumN: (...vals) => vals.reduce((acc, v) => new Decimal(acc).add(v).toNumber(), 0),
  applyFactor: (x, f) => new Decimal(x).mul(f).toNumber(),
  multiply3: (a, b, c) => new Decimal(a).mul(b).mul(c).toNumber(),
  divide: (a, b) => new Decimal(a).div(b).toNumber(),
  identity: (x) => x,
  lineTotal: (u, q) => new Decimal(u).mul(q).toNumber(),
};

export function evaluateExpression(expression: string, context: EvalContext): number {
  const safeCtx: EvalContext = { ...builtinFns, ...context };
  return parser.evaluate(expression, safeCtx as any);
}

// Registry mapping normalized rule codes to TS implementations
export const ruleRegistry = {
  sum2,
  sumN,
  applyFactor,
  multiply3,
  divide,
  identity,
  lineTotal,
};

