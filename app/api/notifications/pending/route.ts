import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { resolveOfficeForRole } from '@/lib/office';
import { QUOTE_STATUSES, USER_ROLES, type QuoteStatus, type UserRole } from '@/lib/workflow';

function coerceUserRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  return (USER_ROLES as readonly string[]).includes(role) ? (role as UserRole) : null;
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ total: 0, items: [] }, { status: 401 });
  }

  const role = coerceUserRole(currentUser.role);
  if (!role) {
    return NextResponse.json({ total: 0, items: [] });
  }

  let officeFilter: string | null = null;
  try {
    officeFilter = resolveOfficeForRole(role, currentUser.office ?? null);
  } catch (error) {
    console.error('[notifications][office]', error);
    return NextResponse.json({ total: 0, items: [] });
  }

  const currentUserId = currentUser.id ?? null;
  const where: Prisma.QuoteWhereInput = {};

  const statusesFor = {
    QS: ['DRAFT'],
    SENIOR_QS: ['SUBMITTED_REVIEW'],
    SALES: ['REVIEWED', 'SENT_TO_SALES', 'NEGOTIATION'],
    PROJECT_MANAGER: QUOTE_STATUSES.filter((status) => status !== 'FINALIZED' && status !== 'ARCHIVED'),
    PROJECT_TEAM: QUOTE_STATUSES.filter((status) => status !== 'FINALIZED' && status !== 'ARCHIVED'),
    ADMIN: ['SUBMITTED_REVIEW', 'REVIEWED', 'SENT_TO_SALES', 'NEGOTIATION'],
  } as Record<UserRole, QuoteStatus[]>;

  if (role === 'ADMIN') {
    where.status = { in: statusesFor.ADMIN };
  } else if (role === 'QS') {
    if (!currentUserId) {
      return NextResponse.json({ total: 0, items: [] });
    }
    where.createdById = currentUserId;
    where.status = { in: statusesFor.QS };
    if (officeFilter) where.office = officeFilter;
  } else if (role === 'SENIOR_QS') {
    where.status = { in: statusesFor.SENIOR_QS };
    if (officeFilter) where.office = officeFilter;
  } else if (role === 'SALES') {
    where.status = { in: statusesFor.SALES };
    if (officeFilter) where.office = officeFilter;
  } else if (role === 'PROJECT_MANAGER') {
    if (!currentUserId) {
      return NextResponse.json({ total: 0, items: [] });
    }
    where.projectManagerId = currentUserId;
    where.status = { in: statusesFor.PROJECT_MANAGER };
  } else if (role === 'PROJECT_TEAM') {
    if (!currentUserId) {
      return NextResponse.json({ total: 0, items: [] });
    }
    where.projectTasks = { some: { assigneeId: currentUserId } };
    where.status = { in: statusesFor.PROJECT_TEAM };
    if (officeFilter) where.office = officeFilter;
  } else {
    return NextResponse.json({ total: 0, items: [] });
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: { customer: { select: { displayName: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const items = quotes.map((quote) => ({
    id: quote.id,
    number: quote.number,
    status: quote.status as QuoteStatus,
    client: quote.customer?.displayName ?? null,
  }));

  return NextResponse.json({ total: items.length, items });
}
