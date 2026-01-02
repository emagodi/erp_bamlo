'use server';

import { Prisma } from '@prisma/client';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveOfficeForRole, ensureQuoteOffice } from '@/lib/office';
import { CreateQuoteSchema } from '@/lib/validation';
import { calcLine, discount as discountFn, grandTotal, netBeforeTax, subtotal, tax } from '@/lib/formulas';
import { money } from '@/lib/money';
import { toBps, toMinor } from '@/helpers/money';
import { buildQuoteSnapshot, createQuoteVersionTx, parseQuoteSnapshot } from '@/lib/quoteSnapshot';
import { getPdfRenderer } from '@/lib/pdf';
import { nextQuoteNumber } from '@/lib/numbering';
import { TX_OPTS } from '@/lib/db-tx';
import {
  QUOTE_STATUSES,
  STATUS_TRANSITION_RULES,
  USER_ROLES,
  type QuoteStatus,
  type UserRole,
  canTransition,
} from '@/lib/workflow';

const quoteInclude = {
  customer: true,
  lines: true,
} satisfies Prisma.QuoteInclude;

const USER_ROLE_SET = new Set<UserRole>(USER_ROLES as unknown as UserRole[]);
const QUOTE_STATUS_SET = new Set<QuoteStatus>(QUOTE_STATUSES as unknown as QuoteStatus[]);

function coerceUserRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  return USER_ROLE_SET.has(role as UserRole) ? (role as UserRole) : null;
}

function assertRole(role: string | null | undefined): UserRole {
  const normalized = coerceUserRole(role);
  if (!normalized) {
    throw new Error('Unsupported user role');
  }
  return normalized;
}

function normalizeQuoteStatus(status: string): QuoteStatus {
  if (QUOTE_STATUS_SET.has(status as QuoteStatus)) {
    return status as QuoteStatus;
  }
  throw new Error(`Unknown quote status: ${status}`);
}

async function ensureSystemUserId() {
  const email = 'system@local';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'System', role: 'ADMIN' },
    select: { id: true },
  });
  return user.id;
}

const parseVatEnvToPercent = (raw: string | undefined) => {
  const value = Number(raw ?? '0.15');
  return value <= 1 ? value * 100 : value;
};

export async function createQuote(input: unknown, currentUserId?: string) {
  try {
    console.log('createQuote input:', JSON.stringify(input, null, 2));
    const parsed = CreateQuoteSchema.parse(input);
    console.log('createQuote parsed:', JSON.stringify(parsed, null, 2));
    if (!parsed.customerId) {
      throw new Error('Customer is required: please select or create a customer before saving.');
    }

  const actingUser = currentUserId
    ? await prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true, role: true, office: true } })
    : await getCurrentUser();

  const userId = actingUser?.id ?? (await ensureSystemUserId());
  const userRole = coerceUserRole(actingUser?.role);
  const userOffice = actingUser ? resolveOfficeForRole(userRole, (actingUser as any).office ?? null) : null;

  const linesCalced = parsed.lines.map((line) =>
    calcLine({
      qty: line.quantity,
      unitPrice: money(line.unitPrice),
      vatRate: parsed.vatRate,
      discount: line.discount ?? null,
    }),
  );

  const sub = subtotal(linesCalced);
  const disc = discountFn(sub, parsed.discountPolicy ?? null);
  const net = netBeforeTax(sub, disc);
  const taxVal = tax(net, parsed.vatRate);
  const grand = grandTotal(net, taxVal);

  const meta = {
    totals: {
      subtotal: Number(sub),
      discount: Number(disc),
      net: Number(net),
      tax: Number(taxVal),
      grandTotal: Number(grand),
    },
  };

  const created = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.create({
      data: {
        currency: parsed.currency,
        vatBps: toBps(parsed.vatRate),
        discountPolicy: parsed.discountPolicy ?? null,
        metaJson: JSON.stringify(meta),
        office: userOffice,
        customer: { connect: { id: parsed.customerId } },
        createdBy: { connect: { id: userId } },
        lines: {
          create: parsed.lines.map((line, idx) => {
            const calc = linesCalced[idx];
            return {
              description: line.description,
              quantity: line.quantity,
              unit: line.unit ?? null,
              product: line.productId ? { connect: { id: line.productId } } : undefined,
              unitPriceMinor: toMinor(Number(line.unitPrice)),
              lineSubtotalMinor: toMinor(Number(calc.lineSubtotal)),
              lineDiscountMinor: toMinor(Number(calc.lineDiscount)),
              lineTaxMinor: toMinor(Number(calc.lineTax)),
              lineTotalMinor: toMinor(Number(calc.lineTotal)),
              metaJson: line.metaJson ? JSON.stringify(line.metaJson) : null,
            };
          }),
        },
      },
      include: quoteInclude,
    });

    // Keep version creation minimal inside tx
    await createQuoteVersionTx(tx, {
      quote: q,
      label: 'Initial save',
      status: 'DRAFT',
      byRole: userRole ?? null,
    });

    return q;
  }, TX_OPTS);

  return { quoteId: created.id };
  } catch (error) {
    console.error('Error creating quote:', error);
    throw error;
  }
}

export async function createAutoQuote(input: {
  baseInputs: Record<string, number>;
  include: { code: string; value: number; unit?: string }[];
  customerId?: string;
  vatRate?: number;
  currency?: string;
}) {
  const actingUser = await getCurrentUser();
  const userId = actingUser?.id ?? (await ensureSystemUserId());
  const userRole = coerceUserRole(actingUser?.role);

  let customerId = input.customerId;
  if (!customerId) {
    const existing = await prisma.customer.findFirst(/* { orderBy: { createdAt: 'asc' } } */);
    customerId = existing?.id ?? (await prisma.customer.create({ data: { displayName: 'Walk-in Customer' } })).id;
  }

  const vatPercent = typeof input.vatRate === 'number' ? input.vatRate * 100 : parseVatEnvToPercent(process.env.VAT_DEFAULT);
  const vatRate = vatPercent > 1 ? vatPercent / 100 : vatPercent;
  const currency = input.currency || process.env.NEXT_PUBLIC_CURRENCY || 'USD';

  const linesCalced = input.include.map((item) =>
    calcLine({
      qty: 1,
      unitPrice: money(item.value),
      vatRate,
    }),
  );

  const sub = subtotal(linesCalced);
  const disc = discountFn(sub, 'none');
  const net = netBeforeTax(sub, disc);
  const taxVal = tax(net, vatRate);
  const grand = grandTotal(net, taxVal);

  const meta = {
    baseInputs: input.baseInputs,
    totals: {
      subtotal: Number(sub),
      discount: Number(disc),
      net: Number(net),
      tax: Number(taxVal),
      grandTotal: Number(grand),
    },
  };

  const created = await prisma.$transaction(async (tx) => {
    const q = await tx.quote.create({
      data: {
        customer: { connect: { id: customerId! } },
        createdBy: { connect: { id: userId } },
        currency,
        vatBps: toBps(vatRate),
        discountPolicy: 'none',
        metaJson: JSON.stringify(meta),
        lines: {
          create: input.include.map((item, idx) => {
            const calc = linesCalced[idx];
            return {
              description: item.code,
              quantity: 1,
              unit: item.unit ?? null,
              unitPriceMinor: toMinor(Number(item.value)),
              lineSubtotalMinor: toMinor(Number(calc.lineSubtotal)),
              lineDiscountMinor: toMinor(Number(calc.lineDiscount)),
              lineTaxMinor: toMinor(Number(calc.lineTax)),
              lineTotalMinor: toMinor(Number(calc.lineTotal)),
              metaJson: JSON.stringify({ code: item.code }),
            };
          }),
        },
      },
      include: quoteInclude,
    });

    await createQuoteVersionTx(tx, {
      quote: q,
      label: 'Initial save',
      status: 'DRAFT',
      byRole: userRole ?? null,
    });

    return q;
  }, TX_OPTS);

  return { quoteId: created.id };
}

export async function transitionQuoteStatus(quoteId: string, target: QuoteStatus) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  const role = assertRole(user.role);
  const userOffice = resolveOfficeForRole(role, user.office ?? null);

  const rule = STATUS_TRANSITION_RULES[target];
  if (!rule) {
    throw new Error(`Transition to ${target} is not supported`);
  }

  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: quoteInclude });
  if (!quote) throw new Error('Quote not found');
  const ensuredOffice = ensureQuoteOffice(quote.office ?? null, role, userOffice);

  if (( target === 'FINALIZED') && role !== 'ADMIN') {
    if (!quote.projectManagerId) {
      throw new Error('Assign a project manager before proceeding');
    }
  }

  const currentStatus = normalizeQuoteStatus(quote.status);
  if (currentStatus === target) {
    return { status: target };
  }

  if (!canTransition(role, currentStatus, target)) {
    throw new Error('You do not have permission for this transition');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const data: Prisma.QuoteUpdateInput = { status: target };
    if (!quote.office && ensuredOffice) {
      data.office = ensuredOffice;
    }
    if (target === 'REVIEWED') {
      data.reviewer = { connect: { id: user.id } };
    }
    if (target === 'SENT_TO_SALES') {
      data.sales = { connect: { id: user.id } };
    }

    const u = await tx.quote.update({
      where: { id: quoteId },
      data,
      include: quoteInclude,
    });

    await createQuoteVersionTx(tx, {
      quote: u,
      label: `Status change: ${target}`,
      status: target,
      byRole: role,
    });

    return u;
  }, TX_OPTS);

  return { status: updated.status as QuoteStatus };
}

export async function finalizeQuote(quoteId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  const role = assertRole(user.role);
  if (role !== 'SALES' && role !== 'ADMIN') {
    throw new Error('Only Sales or Admin users can finalize a quote');
  }
  const userOffice = resolveOfficeForRole(role, user.office ?? null);

  const { updatedQuote, version } = await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId }, include: quoteInclude });
    if (!quote) throw new Error('Quote not found');
    const ensuredOffice = ensureQuoteOffice(quote.office ?? null, role, userOffice);

    const snapshotBefore = buildQuoteSnapshot({ quote });
    const totals = snapshotBefore.totals;
    const existingMeta = snapshotBefore.meta ?? {};
    const number = quote.number ?? (await nextQuoteNumber());
    const officePatch = !quote.office && ensuredOffice ? { office: ensuredOffice } : {};

    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        number,
        status: 'FINALIZED',
        metaJson: JSON.stringify({ ...existingMeta, totals }),
        ...officePatch,
      },
      include: quoteInclude,
    });

    const snapshotAfter = buildQuoteSnapshot({ quote: updated });

    // Get next version via _max to avoid full count scan
    const max = await tx.quoteVersion.aggregate({
      where: { quoteId },
      _max: { version: true },
    });
    const nextVersion = (max._max.version ?? 0) + 1;

    const newVersion = await tx.quoteVersion.create({
      data: {
        quoteId,
        version: nextVersion,
        label: 'Status change: FINALIZED',
        status: 'FINALIZED',
        byRole: role,
        snapshotJson: JSON.stringify(snapshotAfter),
      },
      select: { id: true, version: true, snapshotJson: true },
    });

    return { updatedQuote: updated, version: newVersion };
  }, TX_OPTS);

  // Heavy work AFTER tx commit
  const renderer = await getPdfRenderer();
  const pdf = await renderer.render({ quoteId });
  let downloadFilename = 'quote.pdf';

  if (pdf?.buffer) {
    downloadFilename = pdf.filename;
    const snapshot = parseQuoteSnapshot(version.snapshotJson);
    snapshot.meta = { ...(snapshot.meta ?? {}), pdfBase64: pdf.buffer.toString('base64') };
    await prisma.quoteVersion.update({
      where: { id: version.id },
      data: { snapshotJson: JSON.stringify(snapshot) },
    });
  }

  return { number: updatedQuote.number, version: version.version, downloadFilename };
}

export async function upsertCustomer(input: {
  displayName: string;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  addressJson?: string | null;
}) {
  const { displayName, city = null, email = null, phone = null } = input;
  const addressJson = typeof input.address === 'string' && input.address.trim().length
    ? JSON.stringify({ line1: input.address.trim() })
    : input.addressJson ?? null;
  const existingByEmail = email ? await prisma.customer.findFirst({ where: { email } }) : null;
  if (existingByEmail) {
    return { customerId: existingByEmail.id };
  }
  const existingByNameCity = await prisma.customer.findFirst({
    where: { displayName, city: city ?? undefined },
  });
  if (existingByNameCity) {
    return { customerId: existingByNameCity.id };
  }
  const created = await prisma.customer.create({
    data: { displayName, city: city ?? null, email, phone, addressJson: addressJson ?? undefined },
  });
  return { customerId: created.id };
}







