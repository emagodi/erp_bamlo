import { prisma } from './db';
import { evaluateExpression } from './formulas';

export type BaseInputs = Record<string, number>; // e.g., { 'TakeOff!A4': 71.4, 'TakeOff!B4': 55.45 }

export type EvaluatedValue = {
  code: string;
  value: number;
  expression?: string;
  dependsOn?: string[];
};

function parseDepends(depStr?: string | null): string[] {
  if (!depStr) return [];
  try {
    const arr = JSON.parse(depStr);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function evaluateAll(base: BaseInputs) {
  const rules = await prisma.formulaRule.findMany();
  const byCode = new Map(rules.map((r) => [r.code, r]));

  const context: Record<string, number> = { ...base };
  const evaluated = new Map<string, EvaluatedValue>();

  // Seed context with any numeric constants stored in DB (non-formula cells imported as values)
  for (const r of rules) {
    // no action: imported only formulas use FormulaRule; raw values are not stored here
  }

  const remaining = new Set<string>(rules.map((r) => r.code));

  let progress = true;
  while (progress && remaining.size) {
    progress = false;
    for (const code of Array.from(remaining)) {
      const r = byCode.get(code)!;
      const dependsOn = parseDepends(r.dependsOn as any);
      const canEval = dependsOn.every((d) => d in context);
      if (!canEval) continue;
      try {
        const value = evaluateExpression(r.expression, context);
        context[code] = value;
        evaluated.set(code, { code, value, expression: r.expression, dependsOn });
        remaining.delete(code);
        progress = true;
      } catch {
        // skip for next pass
      }
    }
  }

  return { context, evaluated: Array.from(evaluated.values()) };
}

