// expr.ts
// Safe expression evaluator for codes like "A36+A25", "J22*0.05", "A4/3*3.6", "(A1+B2)*0.5"

export type NumericContext = Record<string, unknown>;

/** Normalize a context so lookups are case-insensitive and keys have no stray spaces. */
export function normalizeContext(ctx: NumericContext): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(ctx || {})) {
    const key = k.trim().toUpperCase();
    const n = Number(v as any);
    out[key] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

/** Return identifiers referenced in the expr that do not have numeric values in ctx. */
export function missingVars(expr: string, ctx: Record<string, number>): string[] {
  const ids = (expr.toUpperCase().match(/[A-Z][A-Z0-9_]*/g) ?? []).map((s) => s.trim());
  return ids.filter((id) => !(id in ctx) || !Number.isFinite(ctx[id]));
}

// -------------------- Tokenizer --------------------

type TokenType = 'num' | 'id' | 'op' | 'lparen' | 'rparen';
type Token = { type: TokenType; value: string };

const OP_SET = new Set(['+', '-', '*', '/']);

function tokenize(expr: string): Token[] {
  const s = expr.trim();
  const tokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    // skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // parentheses
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch });
      i++;
      continue;
    }

    // operators
    if (OP_SET.has(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // number (supports decimals)
    if (/[0-9.]/.test(ch)) {
      let start = i;
      let seenDot = ch === '.';
      i++;
      while (i < s.length) {
        const c = s[i];
        if (c === '.') {
          if (seenDot) break;
          seenDot = true;
          i++;
        } else if (/[0-9]/.test(c)) {
          i++;
        } else {
          break;
        }
      }
      tokens.push({ type: 'num', value: s.slice(start, i) });
      continue;
    }

    // identifier: LETTER followed by [A-Z0-9_]
    if (/[A-Za-z]/.test(ch)) {
      let start = i;
      i++;
      while (i < s.length) {
        const c = s[i];
        if (/[A-Za-z0-9_]/.test(c)) i++;
        else break;
      }
      tokens.push({ type: 'id', value: s.slice(start, i) });
      continue;
    }

    // unknown char -> treat as whitespace separator (skip)
    i++;
  }

  return tokens;
}

// -------------------- Shunting Yard (to RPN) --------------------

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
};

const RIGHT_ASSOC = new Set<string>(); // none of + - * / are right-assoc

function toRPN(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];

    if (t.type === 'num' || t.type === 'id') {
      out.push(t);
      continue;
    }

    if (t.type === 'op') {
      // handle unary minus as 0 - x
      const prev = tokens[idx - 1];
      const isUnaryMinus =
        t.value === '-' &&
        (!prev || prev.type === 'op' || prev.type === 'lparen');

      if (isUnaryMinus) {
        // push 0, then treat '-' as binary op
        out.push({ type: 'num', value: '0' });
      }

      // pop while (stack top op has higher precedence or same and left-assoc)
      while (
        stack.length &&
        stack[stack.length - 1].type === 'op' &&
        (
          PRECEDENCE[stack[stack.length - 1].value] > PRECEDENCE[t.value] ||
          (
            PRECEDENCE[stack[stack.length - 1].value] === PRECEDENCE[t.value] &&
            !RIGHT_ASSOC.has(t.value)
          )
        )
      ) {
        out.push(stack.pop()!);
      }
      stack.push(t);
      continue;
    }

    if (t.type === 'lparen') {
      stack.push(t);
      continue;
    }

    if (t.type === 'rparen') {
      while (stack.length && stack[stack.length - 1].type !== 'lparen') {
        out.push(stack.pop()!);
      }
      if (stack.length && stack[stack.length - 1].type === 'lparen') {
        stack.pop(); // drop '('
      } else {
        // mismatched parentheses; ignore
      }
      continue;
    }
  }

  while (stack.length) out.push(stack.pop()!);
  return out;
}

// -------------------- RPN evaluation --------------------

function safeDiv(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return a / b;
}

function evalRPN(rpn: Token[], ctx: Record<string, number>): number {
  const st: number[] = [];
  for (const t of rpn) {
    if (t.type === 'num') {
      const n = Number(t.value);
      st.push(Number.isFinite(n) ? n : 0);
      continue;
    }
    if (t.type === 'id') {
      const key = t.value.trim().toUpperCase();
      const val = ctx[key];
      st.push(Number.isFinite(val) ? val : 0);
      continue;
    }
    if (t.type === 'op') {
      const b = st.pop() ?? 0;
      const a = st.pop() ?? 0;
      let r = 0;
      switch (t.value) {
        case '+': r = a + b; break;
        case '-': r = a - b; break;
        case '*': r = a * b; break;
        case '/': r = safeDiv(a, b); break;
      }
      st.push(r);
      continue;
    }
    // lparen/rparen should not appear in RPN; ignore
  }
  return st.pop() ?? 0;
}

// -------------------- Public API --------------------

/**
 * Evaluate an expression like "A36+A25", "J22*0.05", "A4/3*3.6", "(A1+B2)*0.5".
 * - Case-insensitive variable lookup
 * - Missing/NaN variables are treated as 0
 * - Division by 0 yields 0 (not NaN/Infinity)
 */
export function evalExpr(context: NumericContext, expr: string): number {
  if (!expr || !expr.trim()) return 0;

  // Normalize once
  const ctx = normalizeContext(context);
  const upper = expr.trim().toUpperCase();

  const tokens = tokenize(upper);
  if (tokens.length === 0) return 0;

  const rpn = toRPN(tokens);
  return evalRPN(rpn, ctx);
}
