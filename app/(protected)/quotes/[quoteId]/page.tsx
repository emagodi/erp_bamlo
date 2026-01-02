import clsx from 'clsx';

import Link from 'next/link';

import { revalidatePath } from 'next/cache';

import LoadingButton from '@/components/LoadingButton';

import Money from '@/components/Money';

import { finalizeQuote, transitionQuoteStatus } from '@/app/(protected)/actions';

import {
  closeNegotiation,
  assignProjectManager,
  createProjectTask,
  updateProjectTask,
  endorseQuote,
  endorseQuoteToProject,
} from '@/app/(protected)/quotes/[quoteId]/actions';

import { prisma } from '@/lib/db';

import { getCurrentUser } from '@/lib/auth';

import { fromMinor } from '@/helpers/money';

import { QuoteStatus, QUOTE_STATUSES, USER_ROLES, UserRole, nextStatusesFor } from '@/lib/workflow';

import { parseQuoteSnapshot, type QuoteSnapshot } from '@/lib/quoteSnapshot';

import type { QuoteLine, QuoteNegotiation, QuoteNegotiationItem } from '@prisma/client';

import { NegotiationActionPair } from '@/components/NegotiationActionPair';

import LineRateEditor from '@/components/LineRateEditor';
import { ensureQuoteOffice } from '@/lib/office';
import { redirect } from 'next/navigation';
import { setFlashMessage } from '@/lib/flash.server';
import { getErrorMessage } from '@/lib/errors';
import SubmitButton from '@/components/SubmitButton';
import PrintButton from '@/components/PrintButton';
import QSEditButton from '@/components/QSEditButton';

const USER_ROLE_SET = new Set<UserRole>(USER_ROLES as unknown as UserRole[]);

const QUOTE_STATUS_SET = new Set<QuoteStatus>(QUOTE_STATUSES as unknown as QuoteStatus[]);

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Draft',

  SUBMITTED_REVIEW: 'Submitted for Review',

  REVIEWED: 'Reviewed',

  SENT_TO_SALES: 'Sent to Sales',

  NEGOTIATION: 'Negotiation',

  FINALIZED: 'Finalized',

  ARCHIVED: 'Archived',
};

const STATUS_BADGE_CLASSES: Record<QuoteStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',

  SUBMITTED_REVIEW: 'bg-blue-100 text-blue-700',

  REVIEWED: 'bg-emerald-100 text-emerald-700',

  SENT_TO_SALES: 'bg-amber-100 text-amber-700',

  NEGOTIATION: 'bg-purple-100 text-purple-700',

  FINALIZED: 'bg-green-100 text-green-700',

  ARCHIVED: 'bg-gray-200 text-gray-600',
};

const STATUS_BUTTON_LABELS: Partial<Record<QuoteStatus, string>> = {
  SUBMITTED_REVIEW: 'Submit for Review',

  REVIEWED: 'Mark Reviewed',

  SENT_TO_SALES: 'Send to Sales',

  NEGOTIATION: 'Move to Negotiation',

  ARCHIVED: 'Archive',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',

  IN_PROGRESS: 'In Progress',

  DONE: 'Completed',
};

export const NEGOTIATION_BADGE_CLASSES: Record<LineNegotiationInfo['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',

  OK: 'bg-blue-100 text-blue-700',

  ACCEPTED: 'bg-emerald-100 text-emerald-700',

  REJECTED: 'bg-red-100 text-red-700',

  REVIEWED: 'bg-indigo-100 text-indigo-700',

  FINAL: 'bg-indigo-100 text-indigo-700',
};

function coerceUserRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;

  return USER_ROLE_SET.has(role as UserRole) ? (role as UserRole) : null;
}

function normalizeStatus(status: string): QuoteStatus {
  if (QUOTE_STATUS_SET.has(status as QuoteStatus)) {
    return status as QuoteStatus;
  }

  throw new Error(`Unknown quote status: ${status}`);
}

type LineNegotiationInfo = {
  status: 'PENDING' | 'OK' | 'ACCEPTED' | 'REJECTED' | 'REVIEWED' | 'FINAL';

  proposedTotal: number;

  proposedRate: number;

  itemId: string;

  reviewerName: string | null;

  reviewedAt: Date | null;

  negotiationStatus: string;
};

type LineRow = {
  id: string;

  description: string;

  unit: string | null;

  qty: number;

  rate: number;

  amount: number;

  source: string | null;

  addedVersion: number | null;

  negotiation: LineNegotiationInfo | null;

  cycle: number;

  isCurrentCycle: boolean;
};

type LineGroup = {
  section: string;

  rows: LineRow[];

  subtotal: number;
};

type QuoteTotals = {
  subtotal: number;

  discount: number;

  net: number;

  tax: number;

  grandTotal: number;
};

type VersionDiff = {
  totalDelta: number | null;

  lineChanges: Array<{ lineId: string; description: string; previous?: number; current: number }>;

  removed: Array<{ lineId: string; description: string; amount: number }>;
};

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function deriveRateFromTotal(total: number, quantity: number, vatRate: number): number {
  if (!(quantity > 0) || !Number.isFinite(total)) {
    return 0;
  }

  const netTotal = total / (1 + vatRate);

  return Number((netTotal / quantity).toFixed(2));
}

function deriveRateFromMinor(
  totalMinor: bigint | number,
  quantity: number,
  vatRate: number
): number {
  return deriveRateFromTotal(fromMinor(totalMinor), quantity, vatRate);
}

function formatDecisionLabel(status: string): string {
  return status

    .toLowerCase()

    .replace(/_/g, ' ')

    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildLineGroups(
  lines: QuoteLine[],

  negotiationByLine: Map<string, LineNegotiationInfo | null>,

  versionNumberById: Map<string, number>,

  activeCycle: number
): LineGroup[] {
  const groups = new Map<string, LineGroup>();

  lines.forEach((line) => {
    const meta = parseJson<Record<string, unknown>>(line.metaJson);

    const section =
      typeof meta?.section === 'string' && meta.section.trim().length > 0 ? meta.section : 'Items';

    const unitFromMeta = typeof meta?.unit === 'string' ? meta.unit : null;

    const rate = fromMinor(line.unitPriceMinor);

    const amount = fromMinor(line.lineTotalMinor);

    const negotiation = negotiationByLine.get(line.id) ?? null;

    if (!groups.has(section)) {
      groups.set(section, { section, rows: [], subtotal: 0 });
    }

    const group = groups.get(section)!;

    const cycle = typeof line.cycle === 'number' ? line.cycle : 0;

    const isCurrentCycle = cycle === activeCycle;

    group.rows.push({
      id: line.id,

      description: line.description,

      unit: line.unit ?? unitFromMeta,

      qty: Number(line.quantity),

      rate,

      amount,

      source: line.source ?? null,

      addedVersion: line.addedInVersionId
        ? (versionNumberById.get(line.addedInVersionId) ?? null)
        : null,

      negotiation,

      cycle,

      isCurrentCycle,
    });

    group.subtotal += amount;
  });

  return Array.from(groups.values());
}

function computeLineTotals(lines: QuoteLine[]): QuoteTotals {
  const subtotalMinor = lines.reduce((acc, line) => acc + BigInt(line.lineSubtotalMinor), 0n);

  const discountMinor = lines.reduce((acc, line) => acc + BigInt(line.lineDiscountMinor), 0n);

  const taxMinor = lines.reduce((acc, line) => acc + BigInt(line.lineTaxMinor), 0n);

  const totalMinor = lines.reduce((acc, line) => acc + BigInt(line.lineTotalMinor), 0n);

  const netMinor = subtotalMinor - discountMinor;

  return {
    subtotal: fromMinor(subtotalMinor),

    discount: fromMinor(discountMinor),

    net: fromMinor(netMinor),

    tax: fromMinor(taxMinor),

    grandTotal: fromMinor(totalMinor),
  };
}

function buildVersionDiff(current: QuoteSnapshot, previous?: QuoteSnapshot): VersionDiff {
  const changes: VersionDiff['lineChanges'] = [];

  const removed: VersionDiff['removed'] = [];

  const previousMap = new Map(previous?.lines.map((line) => [line.lineId, line]) ?? []);

  current.lines.forEach((line) => {
    const prev = previousMap.get(line.lineId);

    if (!prev) {
      changes.push({ lineId: line.lineId, description: line.description, current: line.lineTotal });

      return;
    }

    if (Math.round(line.lineTotalMinor) !== Math.round(prev.lineTotalMinor)) {
      changes.push({
        lineId: line.lineId,

        description: line.description,

        previous: prev.lineTotal,

        current: line.lineTotal,
      });
    }
  });

  if (previous) {
    previous.lines.forEach((prevLine) => {
      if (!current.lines.some((line) => line.lineId === prevLine.lineId)) {
        removed.push({
          lineId: prevLine.lineId,

          description: prevLine.description,

          amount: prevLine.lineTotal,
        });
      }
    });
  }

  const totalDelta = previous ? current.totals.grandTotal - previous.totals.grandTotal : null;

  return { totalDelta, lineChanges: changes, removed };
}

type QuotePageParams = {
  params: Promise<{ quoteId: string }>;
};

export default async function QuoteDetailPage({ params }: QuotePageParams) {
  const { quoteId } = await params;

  const [quote, currentUser, project] = await Promise.all([
    prisma.quote.findUnique({
      where: { id: quoteId },

      include: {
        customer: true,
        project: true,
        lines: {
          orderBy: { createdAt: 'asc' },
        },

        versions: { orderBy: { createdAt: 'desc' } },

        negotiations: {
          include: {
            proposedVersion: true,

            originalVersion: true,

            createdBy: { select: { id: true, name: true, email: true, role: true } },

            items: {
              include: {
                quoteLine: true,

                reviewedBy: { select: { id: true, name: true, email: true } },
              },

              orderBy: { createdAt: 'asc' },
            },
          },

          orderBy: { createdAt: 'desc' },
        },

        projectManager: {
          select: {
            id: true,
            name: true,
            email: true,
            office: true,
            role: true,
            createdAt: true,
            passwordHash: true,
          },
        },

        projectTasks: {
          include: {
            assignee: { select: { id: true, name: true, email: true, office: true } },

            createdBy: { select: { id: true, name: true, email: true, office: true } },
          },

          orderBy: { createdAt: 'asc' },
        },
      },
    }),

    getCurrentUser(),

    // fetch project associated with this quote so `project` is typed correctly
    prisma.project.findFirst({ where: { quoteId } }),
  ]);

  if (!quote) {
    return <div className="p-6">Quote not found</div>;
  }

  if (!currentUser) {
    return <div className="p-6">Authentication required</div>;
  }

  const role = coerceUserRole(currentUser.role);

  if (!role) {
    return <div className="p-6">Unsupported user role</div>;
  }

  const currentUserId = currentUser.id ?? null;

  let officeContext: string | null = null;

  try {
    officeContext = ensureQuoteOffice(quote.office ?? null, role, currentUser.office ?? null);
  } catch (error) {
    console.error('[quote-access]', error);

    return <div className="p-6">You do not have access to this quote.</div>;
  }

  const officeFilter = officeContext ? { office: officeContext } : {};

  const managerCandidates =
    role === 'SALES' || role === 'ADMIN'
      ? await prisma.user.findMany({
          where: { role: 'PROJECT_MANAGER', ...officeFilter },
          orderBy: { name: 'asc' },
        })
      : [];

  const teamCandidates =
    role === 'PROJECT_MANAGER' || role === 'ADMIN'
      ? await prisma.user.findMany({
          where: { role: 'PROJECT_TEAM', ...officeFilter },
          orderBy: { name: 'asc' },
        })
      : [];

  const managerOptions = quote.projectManager
    ? managerCandidates.some((candidate) => candidate.id === quote.projectManager?.id)
      ? managerCandidates
      : [...managerCandidates, quote.projectManager]
    : managerCandidates;

  const teamOptions = (() => {
    const base = [...teamCandidates];

    if (quote.projectManager && !base.some((member) => member.id === quote.projectManager?.id)) {
      base.push(quote.projectManager);
    }

    return base;
  })();

  const projectTasks = quote.projectTasks ?? [];

  const endorseProjectAction = async (formData: FormData) => {
    'use server';

    const commenceOn = String(formData.get('commenceOn') ?? '');
    const deposit = Number(formData.get('deposit') ?? 0);
    const installment = Number(formData.get('installment') ?? 0);
    const installmentDueDate = String(formData.get('installmentDueDate') ?? '');

    const result = await endorseQuoteToProject(quote.id, {
      commenceOn,
      deposit,
      installment,
      installmentDueDate,
    });

    if (!result?.ok) {
      setFlashMessage({
        type: 'error',
        message: result?.error ?? 'Unable to endorse and create project.',
      });
      return redirect(`/quotes/${quote.id}`);
    }

    setFlashMessage({ type: 'success', message: 'Project endorsed and created.' });
    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');
    revalidatePath('/dashboard');
    return redirect('/dashboard');
  };

  const assignProjectManagerAction = async (formData: FormData) => {
    'use server';

    const managerId = formData.get('managerId');
    if (typeof managerId !== 'string' || !managerId) {
      setFlashMessage({ type: 'error', message: 'Manager ID is required.' });
      return redirect(`/quotes/${quote.id}`);
    }

    const result = await assignProjectManager(quote.id, managerId);

    if (!result?.ok) {
      setFlashMessage({ type: 'error', message: result?.error ?? 'Unable to assign manager.' });
    } else {
      setFlashMessage({ type: 'success', message: 'Manager assigned successfully.' });
    }

    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');
    return redirect(`/quotes/${quote.id}`);
  };

  const closeNegotiationAction = async (negotiationId: string) => {
    'use server';

    const result = await closeNegotiation(negotiationId);
    if (!result?.ok) {
      setFlashMessage({ type: 'error', message: result?.error ?? 'Unable to close negotiation.' });
    } else {
      setFlashMessage({ type: 'success', message: 'Negotiation closed.' });
    }
    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');
    redirect(`/quotes/${quote.id}`);
  };

  const createProjectTaskAction = async (formData: FormData) => {
    'use server';

    const title = formData.get('title');
    const description = formData.get('description');
    const assigneeId = formData.get('assigneeId');

    if (typeof title !== 'string' || title.trim().length === 0) {
      setFlashMessage({ type: 'error', message: 'Task title is required.' });
      redirect(`/quotes/${quote.id}`);
    }

    const result = await createProjectTask(quote.id, {
      title: title.trim(),
      description:
        typeof description === 'string' && description.trim().length > 0
          ? description.trim()
          : null,
      assigneeId: typeof assigneeId === 'string' && assigneeId.length > 0 ? assigneeId : null,
    });

    if (!result?.ok) {
      setFlashMessage({ type: 'error', message: result?.error ?? 'Unable to create task.' });
    } else {
      setFlashMessage({ type: 'success', message: 'Task created successfully.' });
    }

    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');
    redirect(`/quotes/${quote.id}`);
  };

  const updateProjectTaskAction = async (formData: FormData) => {
    'use server';

    const taskId = formData.get('taskId');
    const statusValue = formData.get('status');
    const assigneeId = formData.get('assigneeId');

    if (typeof taskId !== 'string' || taskId.length === 0) {
      setFlashMessage({ type: 'error', message: 'Task id missing.' });
      redirect(`/quotes/${quote.id}`);
    }

    const payload: { status?: string; assigneeId?: string | null } = {};

    if (typeof statusValue === 'string' && statusValue.length > 0) {
      payload.status = statusValue;
    }

    if (typeof assigneeId === 'string') {
      payload.assigneeId = assigneeId.length > 0 ? assigneeId : null;
    }

    if (!payload.status && !('assigneeId' in payload)) {
      setFlashMessage({ type: 'info', message: 'No task changes submitted.' });
      redirect(`/quotes/${quote.id}`);
    }

    const result = await updateProjectTask(taskId, payload);

    if (!result?.ok) {
      setFlashMessage({ type: 'error', message: result?.error ?? 'Unable to update task.' });
    } else {
      setFlashMessage({ type: 'success', message: 'Task updated successfully.' });
    }

    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');
    redirect(`/quotes/${quote.id}`);
  };
  const status = normalizeStatus(quote.status);
  const isAdmin = role === 'ADMIN';
  const isSales = role === 'SALES';
  const canSalesEndorse = (isSales || role === 'SALES_ACCOUNTS') && status === 'REVIEWED';

  const isReviewer = role === 'SENIOR_QS' || isAdmin;
  const isProjectManagerUser = role === 'PROJECT_MANAGER';
  const isAssignedProjectManager = Boolean(
    isProjectManagerUser && currentUserId && quote.projectManagerId === currentUserId
  );
  const canAssignProjectManager = isAdmin;
  const canManageTasks = isAdmin || isAssignedProjectManager;
  const canViewVersionsAndNegotiations =
    isAdmin || role === 'MANAGING_DIRECTOR' || role === 'SALES';

  const allowEdit =
    role === 'QS'
      ? status === 'DRAFT'
      : role === 'SENIOR_QS'
        ? status === 'SUBMITTED_REVIEW' || status === 'NEGOTIATION'
        : false;

  const latestNegotiation = quote.negotiations[0] ?? null;

  const vatRate = quote.vatBps / 10000;

  const negotiationByLine = new Map<string, LineNegotiationInfo | null>();

  if (latestNegotiation) {
    latestNegotiation.items.forEach((item) => {
      const quantity = Number(item.quoteLine?.quantity ?? 0);

      const proposedTotal = fromMinor(item.proposedTotalMinor);

      const proposedRate = deriveRateFromTotal(proposedTotal, quantity, vatRate);

      const statusRaw = item.status === 'REVIEWED' ? 'FINAL' : item.status;

      const status = statusRaw as LineNegotiationInfo['status'];

      negotiationByLine.set(item.quoteLineId, {
        status,

        proposedTotal,

        proposedRate,

        itemId: item.id,

        reviewerName: item.reviewedBy?.name ?? item.reviewedBy?.email ?? null,

        reviewedAt: item.reviewedAt,

        negotiationStatus: latestNegotiation.status,
      });
    });
  }

  const versionNumberById = new Map(quote.versions.map((version) => [version.id, version.version]));

  const activeCycle =
    typeof (quote as any).activeCycle === 'number'
      ? (quote as any).activeCycle
      : quote.lines.length
        ? Math.max(...quote.lines.map((l) => (typeof l.cycle === 'number' ? l.cycle : 0)))
        : 0;

  const lineCycleById = new Map(quote.lines.map((line) => [line.id, line.cycle ?? 0]));

  const groups = buildLineGroups(quote.lines, negotiationByLine, versionNumberById, activeCycle);

  const metaTotals = parseJson<{ totals?: QuoteTotals }>(quote.metaJson ?? null)?.totals;

  const computedTotals = computeLineTotals(quote.lines);

  const totals: QuoteTotals = metaTotals
    ? {
        subtotal: metaTotals.subtotal ?? computedTotals.subtotal,

        discount: metaTotals.discount ?? computedTotals.discount,

        net: metaTotals.net ?? computedTotals.net,

        tax: metaTotals.tax ?? computedTotals.tax,

        grandTotal: metaTotals.grandTotal ?? computedTotals.grandTotal,
      }
    : computedTotals;

  const vatPercent = fromMinor(quote.vatBps) / 100;

  const versions = quote.versions.map((version) => ({
    ...version,

    snapshot: parseQuoteSnapshot(version.snapshotJson),
  }));

  const versionDiffs = versions.map((version, index) =>
    buildVersionDiff(version.snapshot, versions[index + 1]?.snapshot)
  );

  const negotiationSnapshots = quote.negotiations.map((negotiation) => ({
    negotiation,

    proposedSnapshot: parseQuoteSnapshot(negotiation.proposedVersion.snapshotJson),

    originalSnapshot: negotiation.originalVersion
      ? parseQuoteSnapshot(negotiation.originalVersion.snapshotJson)
      : null,
  }));

  const transitionTargets = role ? nextStatusesFor(role, status) : [];

  const actionableTargets = transitionTargets.filter((target) => STATUS_BUTTON_LABELS[target]);
  const visibleTargets = actionableTargets;
  const canFinalize = transitionTargets.includes('FINALIZED');
  const canEndorseProject = role === 'SALES' || role === 'ADMIN' || role === 'SALES_ACCOUNTS';
  const showEndorseForm = canEndorseProject && status === 'REVIEWED';
  const canEndorse =
    (role === 'SALES' || role === 'ADMIN' || role === 'SALES_ACCOUNTS') &&
    !quote.project &&
    status === 'REVIEWED';
  const projectDefaults = {
    commenceOn: project?.commenceOn ? project.commenceOn.toISOString().slice(0, 10) : '',
    deposit: project ? fromMinor(project.depositMinor ?? 0) : 0,
    installment: project ? fromMinor(project.installmentMinor ?? 0) : 0,
    //dueDay: project?.installmentDueOn ?? '',
    installmentDueOn: project?.installmentDueOn
      ? project.installmentDueOn.toISOString().slice(0, 10)
      : '',
  } as const;

  const transitionAction = async (formData: FormData) => {
    'use server';

    const target = formData.get('target') as QuoteStatus;
    try {
      await transitionQuoteStatus(quote.id, target);
    } catch (error) {
      setFlashMessage({ type: 'error', message: getErrorMessage(error) });
    }
    // 2) Success path: set flash + choose destination, then RETURN redirect
    setFlashMessage({
      type: 'success',
      message: `Quote moved to ${STATUS_LABELS[target] ?? target}`,
    });

    // If Sales/Admin moves to negotiation, go to client view
    if (target === 'NEGOTIATION' && (role === 'SALES' || role === 'ADMIN')) {
      console.log('Redirecting to client quote view');
      revalidatePath(`/client/quotes/${quote.id}`);
      revalidatePath(`/quotes/${quote.id}`);
      return redirect(`/client/quotes/${quote.id}`);
    }

    // Otherwise, stay on internal quote page
    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');
    return redirect(`/quotes/${quote.id}`);
  };

  const finalizeAction = async () => {
    'use server';
    await finalizeQuote(quote.id);
    setFlashMessage({ type: 'success', message: 'Quote finalized.' });
    revalidatePath(`/quotes/${quote.id}`);
    revalidatePath('/quotes');
    redirect(`/quotes/${quote.id}`);
  };
  const endorseAction = async (formData: FormData) => {
    'use server';
    const commence = String(formData.get('commenceOn') || '');
    const deposit = Number(formData.get('deposit') || 0);
    const installment = Number(formData.get('installment') || 0);
    // const dueDay = Number(formData.get('dueDay') || 1);
    const dueDate = String(formData.get('installmentDueOn'));
    const result = await endorseQuoteToProject(quote.id, {
      commenceOn: commence,
      deposit,
      installment,
      installmentDueDate: dueDate,
    });

    if (!result.ok) {
      setFlashMessage({ type: 'error', message: result.error });
      return;
    }
    setFlashMessage({ type: 'success', message: 'Quote endorsed successfully.' });
    revalidatePath(`/quotes/${quote.id}`);
  };
  console.log('jkjdfjfdhjdfhjdfhjfhjernamz ns');
  console.log(quote?.project);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quote {quote.id ?? '(Draft)'}</h1>

          <div
            className={clsx(
              'mt-2 inline-flex items-center rounded px-2 py-1 text-xs font-semibold',

              STATUS_BADGE_CLASSES[status]
            )}
          >
            Status: {STATUS_LABELS[status]}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {role && (role === 'QS' || role === 'ADMIN') && <QSEditButton quoteId={quote.id} />}

          {visibleTargets.map((target) => (
            <form key={target} action={transitionAction}>
              <input type="hidden" name="target" value={target} />

              <SubmitButton
                loadingText=""
                className={clsx(
                  'rounded px-3 py-1 text-sm shadow-sm transition',
                  STATUS_BUTTON_LABELS[target] === 'Submit for Review' ||
                    STATUS_BUTTON_LABELS[target] === 'Send to Sales' ||
                    STATUS_BUTTON_LABELS[target] === 'Move to Negotiation'
                    ? 'bg-barmlo-green text-white hover:bg-barmlo-green/90'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                )}
              >
                {STATUS_BUTTON_LABELS[target]}
              </SubmitButton>
            </form>
          ))}

          {canFinalize && (
            <form action={finalizeAction}>
              <SubmitButton
                className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                loadingText="Finalizing-"
              >
                Finalize &amp; PDF
              </SubmitButton>
            </form>
          )}
        </div>
      </header>

      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <span className="font-semibold">Customer:</span> {quote.customer?.displayName ?? '-'}
          </div>

          <div>
            <span className="font-semibold">Currency:</span> {quote.currency}
          </div>

          <div>
            <span className="font-semibold">VAT:</span> {vatPercent.toFixed(2)}%
          </div>

          <div>
            <span className="font-semibold">Created:</span>{' '}
            {new Date(quote.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
          <div>
            <span className="font-semibold">Subtotal:</span> <Money value={totals.subtotal} />
          </div>

          <div>
            <span className="font-semibold">Discount:</span> <Money value={totals.discount} />
          </div>

          <div>
            <span className="font-semibold">Net:</span> <Money value={totals.net} />
          </div>

          <div>
            <span className="font-semibold">Tax:</span> <Money value={totals.tax} />
          </div>

          <div>
            <span className="font-semibold">Grand Total:</span> <Money value={totals.grandTotal} />
          </div>
        </div>
      </section>
      {/* {isSales && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Sales Endorsement</h3>
          <form action={endorseAction} className="mt-3 grid gap-3 max-w-md">
            <label className="flex flex-col text-sm">
              <span>Expected Commencement Date</span>
              <input name="commenceOn" type="date" required className="rounded border px-2 py-1" />
            </label>
            <label className="flex flex-col text-sm">
              <span>Deposit Amount</span>
              <input
                name="deposit"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span>Expected Monthly Installment</span>
              <input
                name="installment"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="rounded border px-2 py-1"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span>Installment Due Day (1-28)</span>
              <input
                name="dueDay"
                type="number"
                min="1"
                max="28"
                defaultValue="1"
                className="rounded border px-2 py-1"
              />
            </label>
            <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-white">
              Endorse & Save
            </button>
          </form>
        </section>
      )}
      {showEndorseForm && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Sales Endorsement</h2>
          <p className="mt-1 text-sm text-gray-600">
            Capture the project commencement date and payment schedule for this quote.
          </p>

          {project && (
            <div className="mt-3 space-y-1 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              <div>
                <span className="font-semibold text-gray-900">Project ID:</span> {project.id}
              </div>
              <div>
                <span className="font-semibold text-gray-900">Commences:</span>{' '}
                {project.commenceOn ? new Date(project.commenceOn).toLocaleDateString() : 'TBD'}
              </div>
              <div>
                <span className="font-semibold text-gray-900">Deposit:</span>{' '}
                <Money value={projectDefaults.deposit} />
              </div>
              <div>
                <span className="font-semibold text-gray-900">Installment:</span>{' '}
                <Money value={projectDefaults.installment} />
              </div>
              {projectDefaults.dueDay && (
                <div>
                  <span className="font-semibold text-gray-900">Installment due day:</span>{' '}
                  {projectDefaults.dueDay}
                </div>
              )}
            </div>
          )}

          <form action={endorseProjectAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm font-medium text-gray-700">
              <span>Commencement date</span>
              <input
                type="date"
                name="commenceOn"
                defaultValue={projectDefaults.commenceOn}
                required
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-gray-700">
              <span>Deposit (major)</span>
              <input
                type="number"
                name="deposit"
                step="0.01"
                min="0"
                defaultValue={projectDefaults.deposit.toString()}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-gray-700">
              <span>Installment (major)</span>
              <input
                type="number"
                name="installment"
                step="0.01"
                min="0"
                defaultValue={projectDefaults.installment.toString()}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-gray-700">
              <span>Installment due day</span>
              <input
                type="number"
                name="dueDay"
                min="1"
                max="31"
                defaultValue={projectDefaults.dueDay.toString()}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label>

            <div className="md:col-span-2 flex items-end">
              <LoadingButton
                type="submit"
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                loadingText="Saving..."
              >
                Endorse & Create Project
              </LoadingButton>
            </div>
          </form>
        </section>
      )} */}

      {canSalesEndorse && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Sales Endorsement</h2>
          <p className="mt-1 text-sm text-gray-600">
            Capture the project commencement date and payment schedule for this quote.
          </p>

          {project && (
            <div className="mt-3 space-y-1 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              <div>
                <span className="font-semibold text-gray-900">Project ID:</span> {project.id}
              </div>
              <div>
                <span className="font-semibold text-gray-900">Commences:</span>{' '}
                {project.commenceOn ? new Date(project.commenceOn).toLocaleDateString() : 'TBD'}
              </div>
              <div>
                <span className="font-semibold text-gray-900">Deposit:</span>{' '}
                <Money value={projectDefaults.deposit} />
              </div>
              <div>
                <span className="font-semibold text-gray-900">Installment:</span>{' '}
                <Money value={projectDefaults.installment} />
              </div>
              {projectDefaults.installmentDueOn && (
                <div>
                  <span className="font-semibold text-gray-900">Due Date:</span>{' '}
                  {project.installmentDueOn
                    ? new Date(project.installmentDueOn).toLocaleDateString()
                    : 'TBD'}
                </div>
              )}
            </div>
          )}

          {canEndorse && (
            <form action={endorseProjectAction} className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-gray-700">
                <span>Commencement date</span>
                <input
                  type="date"
                  name="commenceOn"
                  defaultValue={projectDefaults.commenceOn}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>

              <label className="flex flex-col text-sm font-medium text-gray-700">
                <span>Deposit (major)</span>
                <input
                  type="number"
                  name="deposit"
                  step="0.01"
                  min="0"
                  max={totals.grandTotal}
                  defaultValue={projectDefaults.deposit.toString()}
                  className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>

              <label className="flex flex-col text-sm font-medium text-gray-700">
                <span>Installment (major)</span>
                <input
                  type="number"
                  name="installment"
                  step="0.01"
                  min="0"
                  max={totals.grandTotal}
                  defaultValue={projectDefaults.installment.toString()}
                  className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>

              {/* <label className="flex flex-col text-sm font-medium text-gray-700">
              <span>Installment due day</span>
              <input
                type="number"
                name="dueDay"
                min="1"
                max="31"
                defaultValue={projectDefaults.dueDay.toString()}
                className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </label> */}

              <label className="flex flex-col text-sm">
                <span>Installment Due Date</span>
                <input
                  name="installmentDueDate"
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  defaultValue={projectDefaults.installmentDueOn}
                  className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </label>

              <div className="md:col-span-2 flex items-end">
                <SubmitButton
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  loadingText="Saving..."
                >
                  Endorse & Create Project
                </SubmitButton>
              </div>
            </form>
          )}
        </section>
      )}

      {role !== 'SALES' && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
            <div className="lg:max-w-md">
              <h2 className="text-lg font-semibold">Project Assignment</h2>

              <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    Project manager:
                  </span>{' '}
                  {quote.projectManager ? (
                    <span>
                      {quote.projectManager.name ??
                        quote.projectManager.email ??
                        quote.projectManager.id}
                    </span>
                  ) : (
                    <span className="italic text-gray-500 dark:text-gray-400">Not assigned</span>
                  )}
                </div>

                {quote.projectManagerAssignedAt && (
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      Assigned on:
                    </span>{' '}
                    {new Date(quote.projectManagerAssignedAt).toLocaleString()}
                  </div>
                )}
              </div>

              {canAssignProjectManager && managerOptions.length > 0 && (
                <form
                  action={assignProjectManagerAction}
                  className="mt-4 flex flex-col gap-3 max-w-sm"
                >
                  <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                    <span>Select project manager</span>

                    <select
                      name="managerId"
                      defaultValue={quote.projectManagerId ?? ''}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      required
                    >
                      <option value="" disabled>
                        Select manager
                      </option>

                      {managerOptions.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name ?? manager.email ?? manager.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <SubmitButton
                    className="self-start bg-indigo-600 text-white hover:bg-indigo-700"
                    loadingText="Assigning..."
                  >
                    {quote.projectManagerId ? 'Reassign Manager' : 'Assign Manager'}
                  </SubmitButton>
                </form>
              )}

              {canAssignProjectManager && managerOptions.length === 0 && (
                <p className="mt-3 text-xs text-orange-600">
                  No project managers found for this office.
                </p>
              )}
            </div>

            {canManageTasks && (
              <div className="lg:min-w-[280px]">
                <h3 className="text-lg font-semibold">Create Task</h3>

                <form action={createProjectTaskAction} className="mt-3 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                    <span>Task title</span>

                    <input
                      name="title"
                      required
                      className="rounded border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                    <span>Description</span>

                    <textarea
                      name="description"
                      rows={3}
                      className="rounded border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-200">
                    <span>Assignee</span>

                    <select
                      name="assigneeId"
                      defaultValue=""
                      className="rounded border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    >
                      <option value="">Unassigned</option>

                      {teamOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name ?? member.email ?? member.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <SubmitButton
                    className="self-start bg-indigo-600 text-white hover:bg-indigo-700"
                    loadingText="Creating..."
                  >
                    Add Task
                  </SubmitButton>
                </form>
              </div>
            )}
          </div>

          {projectTasks.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-lg font-semibold">Team Tasks</h3>

              <ul className="space-y-3">
                {projectTasks.map((task) => {
                  const assigneeLabel =
                    task.assignee?.name ?? task.assignee?.email ?? task.assigneeId ?? 'Unassigned';

                  return (
                    <li
                      key={task.id}
                      className="rounded border border-gray-200 bg-gray-50 px-3 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {task.title}
                          </div>

                          {task.description && (
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {task.description}
                            </div>
                          )}

                          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            Status:{' '}
                            <span className="font-medium">
                              {TASK_STATUS_LABELS[task.status] ?? task.status}
                            </span>{' '}
                            - Assigned to {assigneeLabel}
                          </div>
                        </div>

                        {canManageTasks && (
                          <form
                            action={updateProjectTaskAction}
                            className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3"
                          >
                            <input type="hidden" name="taskId" value={task.id} />
                            <label className="sr-only" htmlFor={`task-${task.id}-status`}>
                              Task status
                            </label>
                            <select
                              id={`task-${task.id}-status`}
                              name="status"
                              defaultValue={task.status}
                              className="rounded border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            >
                              {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <label className="sr-only" htmlFor={`task-${task.id}-assignee`}>
                              Task assignee
                            </label>
                            <select
                              id={`task-${task.id}-assignee`}
                              name="assigneeId"
                              defaultValue={task.assigneeId ?? ''}
                              className="rounded border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            >
                              <option value="">Unassigned</option>
                              {teamOptions.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name ?? member.email ?? member.id}
                                </option>
                              ))}
                            </select>
                            <SubmitButton
                              className="bg-slate-900 text-white hover:bg-slate-800"
                              loadingText="Updating..."
                            >
                              Update
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded border bg-white shadow-sm">
        {groups.map((group) => (
          <div key={group.section} className="border-b last:border-b-0">
            <div className="border-b bg-gray-50 px-4 py-2 text-lg font-semibold">
              {group.section}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="px-2 py-2">#</th>

                  <th className="px-2 py-2">Description</th>

                  <th className="px-2 py-2">Unit</th>

                  <th className="px-2 py-2 text-right">Qty</th>

                  <th className="px-2 py-2 text-right">Rate</th>

                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              </thead>

              <tbody>
                {group.rows.map((row, idx) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-2 py-2">{idx + 1}</td>

                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span>{row.description}</span>

                          {row.source === 'Manual' && (
                            <span className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                              Manual{row.addedVersion ? ` (v${row.addedVersion})` : ''}
                            </span>
                          )}
                        </div>

                        {!row.isCurrentCycle && (
                          <span className="inline-flex w-fit items-center rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                            Locked (cycle {row.cycle})
                          </span>
                        )}

                        {row.negotiation && (
                          <div className="flex flex-col gap-1 text-xs text-gray-600">
                            <span
                              className={clsx(
                                'inline-flex w-fit items-center rounded px-1.5 py-0.5 font-semibold',

                                NEGOTIATION_BADGE_CLASSES[row.negotiation.status]
                              )}
                            >
                              Proposal: {formatDecisionLabel(row.negotiation.status)}
                            </span>

                            <span>
                              Proposed rate: <Money value={row.negotiation.proposedRate} />
                            </span>

                            {row.negotiation.status !== 'PENDING' &&
                              row.negotiation.reviewerName && (
                                <span>Reviewed by {row.negotiation.reviewerName}</span>
                              )}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-2 py-2">{row.unit ?? '-'}</td>

                    <td className="px-2 py-2 text-right">{row.qty.toLocaleString()}</td>

                    <td className="px-2 py-2 text-right">
                      {allowEdit ? (
                        <LineRateEditor
                          quoteId={quote.id}
                          lineId={row.id}
                          defaultRate={row.rate}
                          defaultQuantity={row.qty}
                        />
                      ) : (
                        <Money value={row.rate} />
                      )}

                      {/* <Money value={row.rate} /> */}
                    </td>

                    <td className="px-2 py-2 text-right">
                      <Money value={row.amount} />
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-gray-50">
                  <td className="px-2 py-2 text-right font-semibold" colSpan={5}>
                    Section Subtotal
                  </td>

                  <td className="px-2 py-2 text-right font-semibold">
                    <Money value={group.subtotal} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
      </section>
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Versions</h2>

        <div className="mt-3 space-y-3">
          {versions.length === 0 && (
            <div className="text-sm text-gray-500">No versions recorded yet.</div>
          )}

          {versions.map((version, index) => {
            const diff = versionDiffs[index];

            return (
              <div key={version.id} className="rounded border border-gray-200 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      v{version.version} - {version.label ?? 'Snapshot'}
                    </div>

                    <div className="text-xs text-gray-500">
                      {new Date(version.createdAt).toLocaleString()} - Status:{' '}
                      {version.status ?? '-'}
                    </div>
                  </div>

                  <div className="text-sm font-semibold">
                    Total: <Money value={version.snapshot.totals.grandTotal} />
                    {diff.totalDelta !== null && diff.totalDelta !== 0 && (
                      <span
                        className={clsx(
                          'ml-2 inline-flex items-center',

                          diff.totalDelta > 0 ? 'text-emerald-600' : 'text-red-600'
                        )}
                      >
                        {diff.totalDelta > 0 ? '+' : '-'}

                        <Money value={Math.abs(diff.totalDelta)} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  {diff.lineChanges.length > 0 ? (
                    <div>
                      <div className="font-medium">Line changes</div>

                      <ul className="mt-1 space-y-1">
                        {diff.lineChanges.map((change) => (
                          <li
                            key={change.lineId}
                            className="flex items-center justify-between gap-2"
                          >
                            <span>{change.description}</span>

                            <span>
                              {change.previous !== undefined && (
                                <span className="mr-2 text-xs text-gray-500 line-through">
                                  <Money value={change.previous} />
                                </span>
                              )}

                              <Money value={change.current} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      No line changes compared to previous version.
                    </div>
                  )}

                  {diff.removed.length > 0 && (
                    <div>
                      <div className="font-medium">Removed lines</div>

                      <ul className="mt-1 space-y-1">
                        {diff.removed.map((removed) => (
                          <li
                            key={removed.lineId}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span>{removed.description}</span>

                            <span className="text-gray-500">
                              <Money value={removed.amount} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {canViewVersionsAndNegotiations && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Negotiations</h2>

          <div className="mt-3 space-y-4">
            {negotiationSnapshots.length === 0 && (
              <div className="text-sm text-gray-500">No negotiations yet.</div>
            )}

            {negotiationSnapshots.map(
              ({ negotiation, proposedSnapshot, originalSnapshot }, index) => {
                const isLatest = index === 0;

                const allItemsResolved = negotiation.items.every(
                  (item) => item.status === 'OK' || item.status === 'ACCEPTED'
                );

                const canCloseProposal =
                  isReviewer && isLatest && negotiation.status === 'OPEN' && allItemsResolved;

                const totalDelta =
                  proposedSnapshot.totals.grandTotal - (originalSnapshot?.totals.grandTotal ?? 0);

                const lineDescription = new Map(
                  quote.lines.map((line) => [line.id, line.description])
                );

                return (
                  <div key={negotiation.id} className="rounded border border-gray-200 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold">
                          {negotiation.status} - {new Date(negotiation.createdAt).toLocaleString()}
                        </div>

                        <div className="text-xs text-gray-500">
                          Requested by{' '}
                          {negotiation.createdBy?.name ?? negotiation.createdBy?.email ?? 'Client'}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 text-sm font-semibold">
                        <div>
                          Proposal Total: <Money value={proposedSnapshot.totals.grandTotal} />
                          {totalDelta !== 0 && (
                            <span
                              className={clsx(
                                'ml-2 inline-flex items-center text-xs font-semibold',

                                totalDelta > 0 ? 'text-emerald-600' : 'text-red-600'
                              )}
                            >
                              {totalDelta > 0 ? '+' : '-'}

                              <Money value={Math.abs(totalDelta)} />
                            </span>
                          )}
                        </div>

                        {canCloseProposal && (
                          <form
                            action={closeNegotiationAction.bind(null, negotiation.id)}
                            className="inline-flex"
                          >
                            <SubmitButton
                              className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                              loadingText="Closing..."
                            >
                              Close Proposal
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1 text-left">Line</th>

                            <th className="px-2 py-1 text-right">Current Rate</th>

                            <th className="px-2 py-1 text-right">Proposed Rate</th>

                            <th className="px-2 py-1 text-left">Status</th>

                            <th className="px-2 py-1 text-left">Reviewer</th>

                            <th className="px-2 py-1 text-left">Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {negotiation.items.map((item) => {
                            const quantity = Number(item.quoteLine?.quantity ?? 0);

                            const currentRate = item.quoteLine
                              ? fromMinor(item.quoteLine.unitPriceMinor)
                              : 0;

                            const proposedRate = deriveRateFromMinor(
                              item.proposedTotalMinor,
                              quantity,
                              vatRate
                            );

                            const lineCycle = lineCycleById.get(item.quoteLineId) ?? 0;

                            const isCurrentCycleLine = lineCycle === activeCycle;

                            const reviewer =
                              item.reviewedBy?.name ?? item.reviewedBy?.email ?? null;

                            const canAct =
                              isLatest &&
                              negotiation.status === 'OPEN' &&
                              item.status === 'PENDING' &&
                              isReviewer &&
                              isCurrentCycleLine;

                            const displayStatus =
                              item.status === 'REVIEWED' ? 'FINAL' : item.status;

                            return (
                              <tr key={item.id} className="border-b last:border-b-0">
                                <td className="px-2 py-1">
                                  {lineDescription.get(item.quoteLineId) ?? 'Line removed'}
                                </td>

                                <td className="px-2 py-1 text-right">
                                  <Money value={currentRate} />
                                </td>

                                <td className="px-2 py-1 text-right">
                                  <Money value={proposedRate} />
                                </td>

                                <td className="px-2 py-1">
                                  <span
                                    className={clsx(
                                      'inline-flex items-center rounded px-1.5 py-0.5 font-semibold',

                                      NEGOTIATION_BADGE_CLASSES[
                                        displayStatus as LineNegotiationInfo['status']
                                      ]
                                    )}
                                  >
                                    {formatDecisionLabel(displayStatus)}
                                  </span>

                                  {!isCurrentCycleLine && (
                                    <span className="mt-1 block text-[10px] uppercase text-gray-400">
                                      Locked (cycle {lineCycle})
                                    </span>
                                  )}
                                </td>

                                <td className="px-2 py-1 text-xs text-gray-500">
                                  {reviewer ? (
                                    <>
                                      {reviewer}

                                      {item.reviewedAt && (
                                        <span className="block text-[10px] uppercase text-gray-400">
                                          {new Date(item.reviewedAt).toLocaleString()}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-gray-400">
                                      {isCurrentCycleLine ? '-' : `Locked (cycle ${lineCycle})`}
                                    </span>
                                  )}
                                </td>

                                <td className="px-2 py-1">
                                  {canAct ? (
                                    <div className="flex flex-wrap gap-2">
                                      <NegotiationActionPair
                                        itemId={item.id}
                                        initialRate={currentRate}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">
                                      {isCurrentCycleLine ? '-' : `Locked (cycle ${lineCycle})`}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <PrintButton />
      </div>
    </div>
  );
}
