// app/(protected)/procurement/requisitions/[requisitionId]/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fromMinor } from '@/helpers/money';
import { parseReviewFlagUpdates, parseUnitPriceUpdates } from '@/lib/requisition-form';
import FundingActionsClient from '../FundingActionsClient';
import FundingApprovalClient from '../FundingApprovalClient';
import ReviewActionsClient from '../ReviewActionsClient';
import {
  approveFunding,
  createPurchase,
  rejectFunding,
  requestTopUp,
  sendRequisitionForReview,
  saveUnitPricesForRequisition,
  submitProcurementRequest,
} from '@/app/(protected)/projects/actions';
import Money from '@/components/Money';
import ProcurementItemsTable from '@/components/ProcurementItemsTable';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import QuantityInput from '@/components/QuantityInput';
import clsx from 'clsx';
import { USER_ROLES, UserRole } from '@/lib/workflow';
import SubmitButton from '@/components/SubmitButton';
import { redirect } from 'next/navigation';
import { setFlashMessage } from '@/lib/flash.server';
import { markAsPurchased, submitRequisition } from './actions';
import { createPartialPOFromPurchases } from '@/app/(protected)/projects/actions';
import PrintButton from '@/components/PrintButton';
import PrintHeader from '@/components/PrintHeader';

export function assertRole(role: string | null | undefined): UserRole {
  if (!role) throw new Error('Unsupported user role');
  const value = String(role) as UserRole;
  if ((USER_ROLES as readonly string[]).includes(value)) return value as UserRole;
  throw new Error('Unsupported user role');
}

export default async function RequisitionDetailPage({
  params,
}: {
  params: Promise<{ requisitionId: string }>;
}) {
  const { requisitionId } = await params;

  const user = await getCurrentUser();

  const req = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: {
      items: {
        include: {
          quoteLine: { select: { metaJson: true, unitPriceMinor: true } },
          topups: { orderBy: { createdAt: 'desc' } },
        },
      },
      project: { include: { quote: { select: { number: true } } } },
      reviewSubmittedBy: { select: { name: true } },
      funding: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, amountMinor: true, createdAt: true },
      },
    },
  });
  if (!req) return <div className="p-6">Requisition not found.</div>;

  const grandMinor = req.items.reduce((acc, it) => acc + BigInt(it.amountMinor ?? 0), 0n);
  const grand = fromMinor(grandMinor);
  const getItemSection = (item: (typeof req.items)[number]) => {
    const rawMeta = item.quoteLine?.metaJson;
    if (typeof rawMeta === 'string' && rawMeta.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawMeta) as { section?: string; category?: string };
        const fromMeta =
          (typeof parsed?.section === 'string' && parsed.section.trim().length > 0
            ? parsed.section
            : typeof parsed?.category === 'string' && parsed.category.trim().length > 0
              ? parsed.category
              : null) ?? null;
        if (fromMeta) return fromMeta.trim();
      } catch {
        // ignore malformed meta JSON
      }
    }
    return 'Uncategorized';
  };
  const groupedItemEntries = (() => {
    const buckets = new Map<string, (typeof req.items)[number][]>();
    for (const item of req.items) {
      const section = getItemSection(item);
      const bucket = buckets.get(section);
      if (bucket) {
        bucket.push(item);
      } else {
        buckets.set(section, [item]);
      }
    }
    return Array.from(buckets.entries());
  })();
  const currency = process.env.NEXT_PUBLIC_CURRENCY || 'USD';
  const groupedForClient = groupedItemEntries.map(([section, items]) => {
    const rows = items.map((it) => {
      const quotedQty = Number(it.qty ?? 0);
      const requestedQty = Number(it.qtyRequested ?? 0);
      const extraQty = Number(it.extraRequestedQty ?? 0);
      const totalRequestedQty = requestedQty + extraQty;
      let quotedTotalMajor = Number(it.amountMinor ?? 0n) / 100;
      let quotedUnitMajor =
        quotedQty > 0 ? quotedTotalMajor / quotedQty : quotedTotalMajor > 0 ? quotedTotalMajor : 0;

      // Fallback: if amountMinor is 0 but we have a linked quote line with a price, use that
      if (quotedUnitMajor === 0 && it.quoteLine?.unitPriceMinor) {
        quotedUnitMajor = Number(it.quoteLine.unitPriceMinor) / 100;
        if (quotedQty > 0) {
          quotedTotalMajor = quotedUnitMajor * quotedQty;
        }
      }

      // If the item has been approved by a reviewer, treat the approved price as the new "quoted" baseline
      // so that we don't show a variance against the old quote.
      if (it.reviewApproved && typeof it.requestedUnitPriceMinor === 'bigint') {
        const approvedUnit = Number(it.requestedUnitPriceMinor) / 100;
        if (approvedUnit > 0) {
          quotedUnitMajor = approvedUnit;
          // Update total too if needed for display, though variance is usually unit-based or total-based
          if (quotedQty > 0) {
            quotedTotalMajor = quotedUnitMajor * quotedQty;
          }
        }
      }

      const requestedUnitMajor =
        typeof it.requestedUnitPriceMinor === 'bigint'
          ? Number(it.requestedUnitPriceMinor) / 100
          : 0;
      const requestedTotalMajor = requestedUnitMajor * (totalRequestedQty || 0);
      return {
        id: it.id,
        description: it.description,
        unit: it.unit,
        quotedQty,
        requestedQty,
        extraQty,
        totalRequestedQty,
        quotedTotalMajor,
        requestedTotalMajor,
        quotedUnitMajor,
        requestedUnitMajor,
        reviewRequested: it.reviewRequested,
        reviewApproved: it.reviewApproved,
        topups: (it.topups || []).map((top) => ({
          id: top.id,
          qtyRequested: Number(top.qtyRequested ?? 0),
          approved: Boolean(top.approved),
          reason: top.reason,
          createdAt: top.createdAt.toISOString(),
        })),
      };
    });
    return { section, items: rows };
  });
  const totals = groupedForClient.reduce(
    (acc, group) => {
      group.items.forEach((row) => {
        acc.quoted += row.quotedTotalMajor;
        acc.requested += row.requestedTotalMajor;
      });
      return acc;
    },
    { quoted: 0, requested: 0 }
  );
  const varianceTotal = totals.requested - totals.quoted;
  const hasPendingReviews = req.items.some((it) => it.reviewRequested && !it.reviewApproved);
  const reviewSubmissionPending = Boolean(req.reviewSubmittedAt);
  const reviewSubmittedLabel = req.reviewSubmittedAt
    ? new Date(req.reviewSubmittedAt).toLocaleString()
    : null;
  const reviewSubmittedByName = req.reviewSubmittedBy?.name ?? 'Procurement';

  const fundingAction = async (formData: FormData) => {
    'use server';
    const updates = parseUnitPriceUpdates(formData);
    if (updates.length) await saveUnitPricesForRequisition(requisitionId, updates);
    const priceMap = new Map(updates.map((u) => [u.itemId, u.unitPriceMajor]));
    const items = await prisma.procurementRequisitionItem.findMany({
      where: { requisitionId },
      select: { id: true, qty: true, qtyRequested: true, requestedUnitPriceMinor: true },
    });
    const missingPrices: string[] = [];
    const amount = items.reduce((sum, item) => {
      const qty = Number(item.qtyRequested ?? item.qty ?? 0);
      if (!(qty > 0)) return sum;
      // Use only the value supplied in this funding form; do not fall back to quoted unit price
      const unit = priceMap.get(item.id);
      if (!(typeof unit === 'number' && unit > 0)) {
        missingPrices.push(item.id);
        return sum;
      }
      return sum + qty * unit;
    }, 0);
    if (missingPrices.length > 0 || !(amount > 0)) {
      await setFlashMessage({
        type: 'error',
        message: 'Enter a unit price for every requisition item before requesting funding.',
      });
      revalidatePath(`/procurement/requisitions/${requisitionId}`);
      return;
    }
    await submitProcurementRequest(requisitionId, amount);
  };

  const sendForReviewAction = async (formData: FormData) => {
    'use server';
    const updates = parseUnitPriceUpdates(formData);
    if (updates.length) await saveUnitPricesForRequisition(requisitionId, updates);
    const reviewFlags = parseReviewFlagUpdates(formData);
    // Persist review flags only; leave existing ones true unless explicitly unchecked
    const trueIds = reviewFlags.filter((r) => r.flag).map((r) => r.itemId);
    const falseIds = reviewFlags.filter((r) => !r.flag).map((r) => r.itemId);
    if (trueIds.length) {
      await prisma.procurementRequisitionItem.updateMany({
        where: { id: { in: trueIds } },
        data: { reviewRequested: true, reviewApproved: false },
      });
    }
    if (falseIds.length) {
      await prisma.procurementRequisitionItem.updateMany({
        where: { id: { in: falseIds } },
        data: { reviewRequested: false },
      });
    }

    // Re-check after updates to ensure at least one is marked
    let pending = await prisma.procurementRequisitionItem.count({
      where: { requisitionId, reviewRequested: true },
    });

    // If none marked, attempt to auto-flag lines whose requested unit price exceeds quoted
    if (pending === 0) {
      const items = await prisma.procurementRequisitionItem.findMany({
        where: { requisitionId },
        select: {
          id: true,
          qty: true,
          qtyRequested: true,
          amountMinor: true,
          requestedUnitPriceMinor: true,
          reviewApproved: true,
          quoteLine: { select: { unitPriceMinor: true } },
        },
      });
      const toFlag: string[] = [];
      for (const it of items) {
        // Skip if already approved
        if (it.reviewApproved) continue;

        const quotedQty = Number(it.qty ?? it.qtyRequested ?? 0);
        let quotedTotalMajor = Number(it.amountMinor ?? 0n) / 100;
        let quotedUnit = quotedQty > 0 ? quotedTotalMajor / quotedQty : quotedTotalMajor;

        // Fallback validation logic same as display
        if (quotedUnit === 0 && it.quoteLine?.unitPriceMinor) {
          quotedUnit = Number(it.quoteLine.unitPriceMinor) / 100;
        }

        const requestedUnit =
          typeof it.requestedUnitPriceMinor === 'bigint'
            ? Number(it.requestedUnitPriceMinor) / 100
            : 0;
        
        // Tolerance? Strict > check
        if (requestedUnit > quotedUnit) {
          toFlag.push(it.id);
        }
      }
      if (toFlag.length) {
        await prisma.procurementRequisitionItem.updateMany({
          where: { id: { in: toFlag } },
          data: { reviewRequested: true, reviewApproved: false },
        });
      }
      pending = await prisma.procurementRequisitionItem.count({
        where: { requisitionId, reviewRequested: true },
      });
    }

    if (pending === 0) {
      await setFlashMessage({
        type: 'error',
        message: 'Mark at least one item for review before sending',
      });
      revalidatePath(`/procurement/requisitions/${requisitionId}`);
      return;
    }

    await sendRequisitionForReview(requisitionId);
  };

  const funding = await prisma.fundingRequest.findFirst({
    where: { requisitionId: requisitionId },
    include: { decidedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const fundingLocked = funding?.status === 'REQUESTED' || funding?.status === 'APPROVED';

  const requisition = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: {
      items: true,
      purchases: true,
    },
  });
  if (!requisition) return <div className="p-4">Requisition not found</div>;

  const purchasedByItem = new Map<string, { qty: number; totalMinor: bigint }>();
  for (const p of requisition.purchases) {
    if (!p.requisitionItemId) continue;
    const key = p.requisitionItemId;
    const prev = purchasedByItem.get(key) ?? { qty: 0, totalMinor: 0n };
    purchasedByItem.set(key, {
      qty: prev.qty + Number(p.qty),
      totalMinor: prev.totalMinor + BigInt(p.priceMinor),
    });
  }

  const projectId = req.projectId;

  /*   const approvedAgg = await prisma.fundingRequest.aggregate({
    where: { status: 'APPROVED', requisitionId },
    _sum: { amountMinor: true },
  });

  const usedAgg = await prisma.purchase.aggregate({
    where: { requisitionId },
    _sum: { priceMinor: true },
  });

  const approvedMinor = BigInt(approvedAgg._sum.amountMinor ?? 0);
  const usedMinor = BigInt(usedAgg._sum.priceMinor ?? 0);
  const remainingMinor = approvedMinor - usedMinor;

  const remaining = fromMinor(remainingMinor);
  const approved = fromMinor(approvedMinor);
  const used = fromMinor(usedMinor);

  const remainingClass =
    remainingMinor >= 0n ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100';
 */

  // existing:
  const approvedAgg = await prisma.fundingRequest.aggregate({
    where: { status: 'APPROVED', requisitionId },
    _sum: { amountMinor: true },
  });

  const usedAgg = await prisma.purchase.aggregate({
    where: { requisitionId },
    _sum: { priceMinor: true },
  });

  // NEW: sum of all disbursements for funding requests under this requisition
  const disbursedAgg = await prisma.fundDisbursement.aggregate({
    where: { fundingRequest: { requisitionId } }, // relies on FundDisbursement -> FundingRequest relation
    _sum: { amountMinor: true },
  });

  // Active top-up (PENDING/REQUESTED/APPROVED = still active)
  const activeTopUp = await prisma.fundingRequest.findFirst({
    where: {
      requisitionId,
      isTopUp: true,
      status: { in: ['REQUESTED', 'APPROVED'] }, // treat APPROVED as still active until fully disbursed (optional)
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, amountMinor: true, requestedAt: true },
  });

  // Safely coerce to BigInt
  const approvedMinor = BigInt(approvedAgg._sum.amountMinor ?? 0);
  const spentMinor = BigInt(usedAgg._sum.priceMinor ?? 0);
  const disbursedMinor = BigInt(disbursedAgg._sum.amountMinor ?? 0);

  // Derived balances (still in minor units)
  const remainingMinor = approvedMinor - spentMinor; // budget remaining
  const cashGapMinor = disbursedMinor - spentMinor; // cash position; negative => bought on credit

  // Convert to major (number) using your helper
  const approved = fromMinor(approvedMinor);
  const used = fromMinor(spentMinor);
  const disbursed = fromMinor(disbursedMinor);
  const remaining = fromMinor(remainingMinor);
  const cashGap = fromMinor(cashGapMinor);

  const remainingClass = remainingMinor >= 0n ? 'text-emerald-700' : 'text-red-700';
  const cashGapClass = cashGapMinor >= 0n ? 'text-emerald-700' : 'text-red-700';

  const role = assertRole(user?.role);

  const isProcurement = role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT' || role === 'ADMIN';
  const isSecurity = role === 'SECURITY' || role === 'ADMIN';
  const canViewVariance = role === 'SENIOR_PM' || role === 'SENIOR_PROCUREMENT' || role === 'MANAGING_DIRECTOR' || role === 'ADMIN';
  const showReviewControls = role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT';
  const fundingFormId = 'funding-form';
  const lastFundingStatus = req.funding?.[0]?.status;
  const isFundingRequested = lastFundingStatus === 'REQUESTED';

  const reviewFormId = 'review-form';
  const lockedByAccounts = funding?.status && funding.status !== 'REJECTED';
  const permissions = {
    canRequestTopUp: ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN'].includes(role),
    canApproveTopUp: ['SENIOR_PM', 'MANAGING_DIRECTOR', 'ADMIN'].includes(role),
    canToggleReview: ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'PROJECT_MANAGER', 'ADMIN'].includes(role),
    canApproveReview: ['SENIOR_PROCUREMENT', 'MANAGING_DIRECTOR', 'ADMIN'].includes(role),
    canEditUnitPrice: ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN'].includes(role) && !lockedByAccounts,
  };

  // Hide Top-up form when there is an active top-up OR funds remain
  const hideTopUpForm = Boolean(activeTopUp) || remainingMinor > 0n;

  return (
    <div className="space-y-6 p-6">
      <PrintHeader />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {funding?.status === 'APPROVED' ? 'Purchase Order' : 'Procurement Requisition'}
          </h1>
          <div className="text-sm text-gray-600">
            <div>
              <span className="font-medium">Requisition:</span> {req.id}
            </div>
            <div>
              <span className="font-medium">Project:</span> {req.projectId}
            </div>
            <div>
              <span className="font-medium">Quote:</span> {req.project?.quote?.number ?? '-'}
            </div>
          </div>
        </div>
        {req.status === 'DRAFT' && ['PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN'].includes(role) && (
          <form action={submitRequisition.bind(null, req.id)}>
            <SubmitButton className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
              Submit Requisition
            </SubmitButton>
          </form>
        )}
        <div className="flex gap-3">
          {/* {req.status === 'SUBMITTED' && ['PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN'].includes(role) && (
            <Link 
              href={`/procurement/purchase-orders/create?requisitionId=${req.id}`}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center"
            >
              Create direct PO
            </Link>
          )} */}
          {req.status === 'DRAFT' && ['PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN'].includes(role) && (
            <form action={submitRequisition.bind(null, req.id)}>
              <SubmitButton className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                Submit Requisition
              </SubmitButton>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

        {/* Budget summary hidden as requested */}
        {/* <div className="mt-2 text-sm space-x-2">
        <span>
          Approved:{' '}
          <b>
            <Money value={approved} />
          </b>
        </span>
        <span>·</span>
        <span>
          Disbursed:{' '}
          <b>
            <Money value={disbursed} />
          </b>
        </span>
        <span>·</span>
        <span>
          Spent:{' '}
          <b>
            <Money value={used} />
          </b>
        </span>
        <span>·</span>
        <span className={remainingClass}>
          Remaining:{' '}
          <b>
            <Money value={remaining} />
          </b>
        </span>
        <span>·</span>
        <span className={cashGapClass}>
          Cash remaining:{' '}
          <b>
            <Money value={cashGap} />
          </b>
        </span>
      </div> */}

      <section className="rounded border bg-white p-4 shadow-sm">
        <div
          className={clsx(
            'grid gap-4 text-sm text-gray-700',
            canViewVariance ? 'md:grid-cols-4' : 'md:grid-cols-3'
          )}
        >
          {/* Quoted/Requested Budget cards hidden as requested */}
          {/* <div>
            <div className="text-xs uppercase text-gray-500">Quoted Budget</div>
            <div className="text-xl font-semibold text-slate-900">
              <Money value={totals.quoted} />
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-500">Requested Budget</div>
            <div className="text-xl font-semibold text-slate-900">
              <Money value={totals.requested} />
            </div>
          </div> */}
          {canViewVariance && (
            <div>
              <div className="text-xs uppercase text-gray-500">Variance</div>
              <div
                className={clsx(
                  'text-xl font-semibold',
                  varianceTotal > 0
                    ? 'text-rose-600'
                    : varianceTotal < 0
                      ? 'text-emerald-600'
                      : 'text-slate-900'
                )}
              >
                <Money value={varianceTotal} />
              </div>
            </div>
          )}
          <div>
            <div className="text-xs uppercase text-gray-500">Items in review</div>
            <div className="text-xl font-semibold text-slate-900">
              {req.items.filter((it) => it.reviewRequested).length}
            </div>
          </div>
        </div>
        <div className="mt-4 max-h-[60vh] overflow-y-auto scrollbar-y">
          <ProcurementItemsTable
            grouped={groupedForClient}
            permissions={permissions}
            currency={currency}
            showTopUps={false} // Hidden as requested
            showVariance={canViewVariance}
            unitPriceFormIds={[fundingFormId, reviewFormId]}
            reviewFlagFormIds={[reviewFormId]}
            showReviewControls={showReviewControls && !fundingLocked}
            readOnly={reviewSubmissionPending || fundingLocked}
            hideFinancials={role === 'PROJECT_MANAGER' && !fundingLocked}
          />
        </div>
      </section>

      {/* Show Accounts Decision Amount if Funding is Approved */}
      {funding?.status === 'APPROVED' && (
        <section className="rounded border bg-emerald-50 border-emerald-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-emerald-900">Accounts Decision</h3>
          <div className="mt-2 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <span className="font-medium">Approved Amount:</span>
              <span className="text-lg font-bold">
                <Money value={Number(funding.amountMinor) / 100} />
              </span>
            </div>
            <div className="mt-1">
              <span className="font-medium">Decided by:</span> {funding.decidedBy?.name || funding.decidedBy?.email || 'Accounts'}
            </div>
            {funding.decidedAt && (
              <div>
                <span className="font-medium">Date:</span> {new Date(funding.decidedAt).toLocaleString()}
              </div>
            )}
          </div>
        </section>
      )}

      {isProcurement && hasPendingReviews && (
        <div className="rounded border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {reviewSubmissionPending ? (
            <p>
              Sent to Senior Procurement on {reviewSubmittedLabel} by {reviewSubmittedByName}.
              Awaiting approval.
            </p>
          ) : (
            <ReviewActionsClient
              reviewFormId={reviewFormId}
              sendForReviewAction={sendForReviewAction}
            />
          )}
        </div>
      )}

      {user?.role === 'PROCUREMENT' && !fundingLocked && (
        <FundingActionsClient
          canRequestFunding
          fundingPending={hasPendingReviews}
          fundingAction={fundingAction}
          reviewFormId={reviewFormId}
        />
      )}

      {/* Accounts Approval UI */}
      {(['ACCOUNTS', 'ACCOUNTING_OFFICER', 'ADMIN', 'MANAGING_DIRECTOR'].includes(role)) && isFundingRequested && req.funding?.[0] && (
          <FundingApprovalClient
            handleApproveFunding={async () => { 'use server'; await approveFunding(req.funding[0].id); }}
            handleRejectFunding={async (fd) => { 'use server'; await rejectFunding(req.funding[0].id, String(fd.get('reason') || '')); }}
            amount={Number(req.funding[0].amountMinor ?? 0) / 100}
          />
      )}

      {isProcurement && funding?.status === 'APPROVED' && requisition.status !== 'PURCHASED' && (
        <form
          action={async () => {
            'use server';
            await markAsPurchased(requisitionId);
          }}
          className="mt-4"
        >
          {(() => {
             const allPurchased = requisition.items.every(it => {
               const bought = purchasedByItem.get(it.id)?.qty ?? 0;
               return bought >= (it.qtyRequested ?? it.qty ?? 0);
             });
             const somePurchased = requisition.items.some(it => {
               const bought = purchasedByItem.get(it.id)?.qty ?? 0;
               return bought > 0;
             });

             let label = 'Purchase Materials';
             let color = 'bg-indigo-600 hover:bg-indigo-700';

             if (allPurchased) {
               label = 'Complete & Close';
               color = 'bg-emerald-600 hover:bg-emerald-700';
             } else if (somePurchased) {
               label = 'Purchase Remaining';
               color = 'bg-orange-600 hover:bg-orange-700';
             }

             return (
              <SubmitButton
                loadingText={allPurchased ? 'Closing...' : 'Processing...'}
                className={`rounded px-4 py-2 text-white font-medium ${color}`}
              >
                {label}
              </SubmitButton>
             );
          })()}
        </form>
      )}

      {/* Budget section hidden as requested */}
      {/* <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Budget</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded border border-gray-200 p-3">
            <div className="text-gray-500">Approved</div>
            <div className="text-base font-semibold">
              <Money value={approved} />
            </div>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <div className="text-gray-500">Used (Purchases)</div>
            <div className="text-base font-semibold">
              <Money value={used} />
            </div>
          </div>
          <div className={clsx('rounded p-3', remainingClass)}>
            <div className="text-sm font-medium">Remaining</div>
            <div className="text-base font-bold">
              <Money value={Math.abs(remaining)} />
              {remainingMinor < 0n && <span className="ml-2 text-xs font-semibold">(Over)</span>}
            </div>
          </div>
        </div>
      </section> */}

      {/* Accounts Decision section removed as per user request */}

      {activeTopUp && (
        <div className="mt-3 rounded bg-amber-50 border border-amber-200 p-3 text-sm">
          <div className="font-medium">Top-up in progress</div>
          <div>Status: {activeTopUp.status}</div>
          <div>
            Amount: <Money value={Number(activeTopUp.amountMinor) / 100} />
          </div>
          <div>Requested: {new Date(activeTopUp.requestedAt!).toLocaleString()}</div>
        </div>
      )}

      {/* Procurement: request surplus */}
      {/* {(role === 'PROCUREMENT' || role === 'PROJECT_MANAGER' || role === 'ADMIN') && (
        <form
          action={async (fd) => {
            'use server';
            await requestTopUp(requisition.id, {
              amount: Number(fd.get('amount') || 0),
              note: String(fd.get('note') || ''),
            });
          }}
          className="mt-4 grid max-w-md grid-cols-3 gap-2 text-sm"
        >
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            placeholder="Top-up amount"
            className="rounded border px-2 py-1 col-span-2"
          />
          <input
            name="note"
            placeholder="Reason (optional)"
            className="rounded border px-2 py-1 col-span-3"
          />
          <button className="rounded bg-slate-900 px-3 py-1.5 text-white col-span-1">
            Request Top-up
          </button>
        </form>
      )} */}

      {/* Procurement / PM / Admin can request a top-up, but we hide the form if funds remain or there is an active top-up */}
      {/* Top-up form hidden as requested */}
      {/* {(role === 'PROCUREMENT' || role === 'PROJECT_MANAGER' || role === 'ADMIN') && (
        <>
          {!hideTopUpForm ? (
            <form
              action={async (fd) => {
                'use server';
                await requestTopUp(requisition.id, Number(fd.get('amount') || 0));
                revalidatePath(`/procurement/requisitions/${requisitionId}`);
              }}
              className="mt-4 grid max-w-md grid-cols-3 gap-2 text-sm"
            >
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="Top-up amount"
                className="rounded border px-2 py-1 col-span-2"
              />
              <input
                name="note"
                placeholder="Reason (optional)"
                className="rounded border px-2 py-1 col-span-3"
              />
              <button className="rounded bg-slate-900 px-3 py-1.5 text-white col-span-1">
                Request Top-up
              </button>
            </form>
          ) : (
            <p className="mt-3 text-xs text-gray-500">
              {activeTopUp
                ? 'A top-up is already active; new requests are hidden until it is decided or finished.'
                : 'Funds remain from the current budget; a top-up becomes available after funds are exhausted.'}
            </p>
          )}
        </>
      )} */}

      {isProcurement &&
        (requisition.status === 'PURCHASED' ||
          requisition.status === 'PARTIAL' ||
          requisition.status === 'APPROVED') && (
          <section className="rounded border bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold">Stage Purchases</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enter items you have bought to <b>stage</b> them. Once you are ready, click &quot;Create PO&quot; to group them for Security.
            </p>

            {/* Staged Items List */}
            {(() => {
              const pendingPurchases = requisition.purchases.filter(p => !p.purchaseOrderId); // or status === 'PENDING'
              if (pendingPurchases.length > 0) {
               return (
                 <div className="mb-6 rounded bg-amber-50 border border-amber-200 p-4">
                   <div className="flex items-center justify-between mb-2">
                     <h4 className="font-semibold text-amber-900">Staged Items ({pendingPurchases.length})</h4>
                     <form action={createPartialPOFromPurchases.bind(null, requisitionId)}>
                       <SubmitButton className="rounded bg-amber-600 px-3 py-1.5 text-white text-sm hover:bg-amber-700">
                         Create PO from Staged Items
                       </SubmitButton>
                     </form>
                   </div>
                   <table className="w-full text-sm text-left">
                     <thead>
                       <tr className="text-gray-500 border-b border-amber-200">
                         <th className="py-1 pl-2">Item Name</th>
                         <th className="py-1 text-right">Qty</th>
                         <th className="py-1 px-2">Vendor</th>
                         <th className="py-1">Ref</th>
                         <th className="py-1 text-right">Unit Price</th>
                         <th className="py-1 text-right pr-2">Total</th>
                       </tr>
                     </thead>
                     <tbody>
                       {pendingPurchases.map(p => {
                         const unitPrice = p.qty > 0 ? (Number(p.priceMinor) / 100) / p.qty : 0;
                         const itemDesc = requisition.items.find(i => i.id === p.requisitionItemId)?.description ?? 'Unknown Item';
                         return (
                           <tr key={p.id} className="border-b border-amber-100 last:border-0 hover:bg-amber-100/50">
                             <td className="py-1 pl-2 font-medium">{itemDesc}</td>
                             <td className="py-1 text-right">{p.qty}</td>
                             <td className="py-1 px-2">{p.vendor}</td>
                             <td className="py-1">{p.taxInvoiceNo}</td>
                             <td className="py-1 text-right"><Money value={unitPrice} /></td>
                             <td className="py-1 text-right pr-2 font-semibold"><Money value={Number(p.priceMinor) / 100} /></td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               );
              }
              return null;
            })()}

            <h3 className="text-lg font-semibold mt-6">All Purchases</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Req. Qty</th>
                    <th className="px-3 py-2 text-right">Purchased</th>
                    <th className="px-3 py-2 text-right">Remaining</th>
                    <th className="px-3 py-2 text-left">Add Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {requisition.items.map((it) => {
                    const bought = purchasedByItem.get(it.id) ?? { qty: 0, totalMinor: 0n };
                    const remaining = Math.max(0, Number(it.qtyRequested ?? 0) - bought.qty);

                    return (
                      <tr key={it.id} className="border-b last:border-b-0 align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium">{it.description}</div>
                          <div className="text-xs text-gray-600">{it.unit ?? '-'}</div>
                          <div className="text-xs text-gray-500">
                            Est: <Money value={Number(it.amountMinor) / 100} />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{Number(it.qtyRequested ?? 0)}</td>
                        <td className="px-3 py-2 text-right">{bought.qty}</td>
                        <td className="px-3 py-2 text-right">{remaining}</td>
                        <td className="px-3 py-2">
                          {remaining > 0 ? (
                            <form
                              action={async (fd) => {
                                'use server';
                                await createPurchase({
                                  requisitionId: requisition.id,
                                  requisitionItemId: it.id,
                                  vendor: String(fd.get('vendor') || ''),
                                  taxInvoiceNo: String(fd.get('taxInvoiceNo') || ''),
                                  vendorPhone: String(fd.get('vendorPhone') || ''),
                                  qty: Number(fd.get('qty') || 0),
                                  unitPrice: Number(fd.get('unitPrice') || 0),
                                  date: String(
                                    fd.get('date') || new Date().toISOString().slice(0, 10)
                                  ),
                                  invoiceUrl: null,
                                });
                              }}
                              className="grid grid-cols-2 gap-2"
                            >
                              <input
                                name="vendor"
                                placeholder="Vendor"
                                className="rounded border px-2 py-1"
                                required
                              />
                              <input
                                name="vendorPhone"
                                placeholder="Phone number (optional)"
                                className="rounded border px-2 py-1"
                              />
                              <input
                                name="taxInvoiceNo"
                                placeholder="Tax Invoice No"
                                className="rounded border px-2 py-1"
                                required
                              />

                              {/* clamp qty on the client */}
                              <QuantityInput
                                name="qty"
                                max={remaining}
                                className="rounded border px-2 py-1"
                              />

                              <input
                                name="unitPrice"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Unit Price"
                                className="rounded border px-2 py-1"
                                required
                              />
                              <input
                                name="date"
                                type="date"
                                className="rounded border px-2 py-1"
                                defaultValue={new Date().toISOString().slice(0, 10)}
                              />
                              <SubmitButton
                                loadingText="Staging..."
                                className="col-span-2 rounded bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800"
                              >
                                Stage for PO
                              </SubmitButton>
                            </form>
                          ) : (
                            <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Fully purchased
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
    </div>
  );
}
