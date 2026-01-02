// lib/expr.ts
type Ctx = Record<string, unknown>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// tokenize: identifiers, numbers, operators, parentheses
function tokenize(s: string): string[] {
  const out: string[] = [];
  const re = /\s*([A-Za-z]\w*|\d*\.?\d+|[()+\-*/])\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}

// shunting-yard (handles unary minus)
function toRPN(tokens: string[]): string[] {
  const out: string[] = [];
  const ops: string[] = [];
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  let prev: string | null = null;

  for (const t of tokens) {
    if (/^\d*\.?\d+$/.test(t) || /^[A-Za-z]\w*$/.test(t)) {
      out.push(t);
    } else if (t === '(') {
      ops.push(t);
    } else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()!);
      ops.pop();
    } else if ('+-*/'.includes(t)) {
      const unaryMinus = t === '-' && (prev === null || '()+-*/'.includes(prev));
      if (unaryMinus) out.push('0');
      while (
        ops.length &&
        ops[ops.length - 1] !== '(' &&
        (prec[ops[ops.length - 1]] > prec[t] || prec[ops[ops.length - 1]] === prec[t])
      ) {
        out.push(ops.pop()!);
      }
      ops.push(t);
    }
    prev = t;
  }
  while (ops.length) out.push(ops.pop()!);
  return out;
}

function evalRPN(rpn: string[], ctx: Ctx): number {
  const st: number[] = [];
  for (const t of rpn) {
    if (/^\d*\.?\d+$/.test(t)) st.push(Number(t));
    else if (/^[A-Za-z]\w*$/.test(t)) st.push(num(ctx[t]));
    else {
      const b = st.pop() ?? 0;
      const a = st.pop() ?? 0;
      st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : b === 0 ? 0 : a / b);
    }
  }
  const v = st.pop() ?? 0;
  return Number.isFinite(v) ? v : 0;
}

export function evalExpr(ctx: Ctx, expr: string): number {
  if (!expr || typeof expr !== 'string') return 0;
  return evalRPN(toRPN(tokenize(expr)), ctx);
}
