import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertRole } from '@/lib/workflow';
import { computeBalances, nextDueDate, formatDateYMD } from '@/lib/accounting';
import Link from 'next/link';
import DispatchTableClient from '@/components/DispatchTableClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createDispatchFromPurchases,
  createDispatchFromInventory,
  createDispatchFromSelectedInventory,
  createRequisitionFromQuote,
  generatePaymentSchedule,
  createDispatchFromPurchasesAndTools,
  createMultipurposeDispatch,
  createScheduleFromQuote,
  requestFunding,
  ensureProjectIsPlanned,
} from '../actions';
import { createPOFromRequisition } from '@/app/(protected)/procurement/requisitions/[requisitionId]/actions';
import Money from '@/components/Money';
import { createDispatch as create_dispatch } from './dispatch-actions';
import { fromMinor } from '@/helpers/money';
import { recordDisbursement } from '@/app/(protected)/projects/actions';
import { recordClientPayment } from '@/app/(protected)/accounts/actions';
import SubmitButton from '@/components/SubmitButton';
import { setFlashMessage } from '@/lib/flash.server';
import ScheduleBlock from './_Schedule';
import { WorkflowStatusBadge } from '@/components/ui/workflow-status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import DailyTasksPage from './daily-tasks/page';
import ProjectReportsPage from './reports/page';

export const runtime = 'nodejs';

async function createProcurementRequisition(projectId: string, note?: string) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (role !== 'PROJECT_MANAGER' && role !== 'ADMIN') throw new Error('Only PM/Admin');
  await ensureProjectIsPlanned(projectId);
  await prisma.procurementRequisition.create({
    data: { projectId, status: 'PENDING', note: note ?? null, submittedById: user.id! },
  });
  revalidatePath(`/projects/${projectId}`);
}

async function recordPurchase(
  requisitionId: string,
  input: { vendor: string; taxInvoiceNo: string; price: number; date: string }
) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (!['PROCUREMENT', 'SENIOR_PROCUREMENT', 'ADMIN'].includes(role)) throw new Error('Only Procurement/Admin');
  const reqProject = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    select: { projectId: true },
  });
  if (!reqProject) throw new Error('Requisition not found');
  await ensureProjectIsPlanned(reqProject.projectId);
  await prisma.purchase.create({
    data: {
      requisitionId,
      vendor: input.vendor,
      taxInvoiceNo: input.taxInvoiceNo,
      priceMinor: BigInt(Math.round(input.price * 100)),
      purchasedAt: new Date(input.date),
    },
  });
  revalidatePath(`/projects/${reqProject.projectId}`);
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
  };
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${m[status] || 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  );
}

async function createDispatch(
  projectId: string,
  items: Array<{ description: string; qty: number; unit?: string | null; requisitionItemId?: string | null }>
) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (!['PROJECT_MANAGER', 'ADMIN'].includes(role)) throw new Error('Only PM/Admin');
  await ensureProjectIsPlanned(projectId);

  // Validate quantities against inventory/purchases
  for (const item of items) {
    if (item.requisitionItemId) {
      const [purchasedAgg, dispatchedAgg] = await Promise.all([
        prisma.purchase.aggregate({
          where: { requisitionItemId: item.requisitionItemId },
          _sum: { qty: true },
        }),
        prisma.dispatchItem.aggregate({
          where: { requisitionItemId: item.requisitionItemId },
          _sum: { qty: true },
        }),
      ]);
      const purchased = Number(purchasedAgg._sum.qty ?? 0);
      const dispatched = Number(dispatchedAgg._sum.qty ?? 0);
      const remaining = Math.max(0, purchased - dispatched);
      
      if (item.qty > remaining) {
        throw new Error(`Cannot dispatch ${item.qty} of ${item.description}. Only ${remaining} remaining.`);
      }
    }
  }

  await prisma.dispatch.create({
    data: {
      projectId,
      items: {
        create: items.map((i) => ({
          description: i.description,
          qty: i.qty,
          unit: i.unit ?? null,
          requisitionItemId: i.requisitionItemId ?? null,
        })),
      },
    },
  });
  revalidatePath(`/projects/${projectId}`);
}

async function securityApprove(dispatchId: string, driverName: string) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (!['SECURITY', 'ADMIN'].includes(role)) throw new Error('Only Security/Admin');
  const d = await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { status: 'OUT_FOR_DELIVERY', securityById: user.id!, driverName },
    include: { project: true },
  });
  revalidatePath(`/projects/${d.projectId}`);
}

async function markDelivered(dispatchId: string, signedBy: string) {
  'use server';
  const user = await getCurrentUser();
  if (!user) throw new Error('Auth required');
  const role = assertRole(user.role);
  if (!['DRIVER', 'SECURITY', 'ADMIN'].includes(role))
    throw new Error('Only Driver/Security/Admin');

  let d = null;
  if (['DRIVER'].includes(role)) {
    d = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { status: 'DELIVERED', signedBy, driverSignedAt: new Date(), driverById: user.id! },
      include: { project: true },
    });
  }
  if (['SECURITY'].includes(role)) {
    d = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { status: 'DELIVERED', signedBy, securitySignedAt: new Date(), securityById: user.id! },
      include: { project: true },
    });
  }

  if (['ADMIN'].includes(role)) {
    d = await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { status: 'DELIVERED', signedBy },
      include: { project: true },
    });
  }

  if (!d) throw new Error('Failed to mark delivered');
  revalidatePath(`/projects/${d.projectId}`);
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6">Auth required</div>;
  const role = assertRole(user.role);
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      quote: { select: { number: true, metaJson: true, customer: { select: { displayName: true, email: true, phone: true, city: true } } } },
      requisitions: { include: { items: true, funding: true } },
      dispatches: { include: { items: true } },
      clientPayments: true,
      assignedTo: true,
    },
  });

  const { tab } = await searchParams;


  if (!project) return <div className="p-6">Not found</div>;

  // Strict Access Control for Project Managers
  if (role === 'PROJECT_MANAGER' && project.assignedToId !== user.id) {
    redirect('/projects');
  }

  const hasSchedule = (await prisma.schedule.count({ where: { projectId } })) > 0;

  const requisitions = await prisma.procurementRequisition.findMany({
    where: { projectId: projectId },
    include: {
      funding: {
        include: {
          requestedBy: { select: { name: true, email: true } },
          decidedBy: { select: { name: true, email: true } },
          disbursements: { select: { id: true, amountMinor: true, paidAt: true, ref: true, attachmentUrl: true } },
        },
      },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { projectId: projectId },
    select: { id: true, requisitionId: true, status: true, vendor: true },
  });

  // Sort funding arrays client-side
  requisitions.forEach((r) => {
    const funding = (r as any).funding;
    if (Array.isArray(funding)) {
      funding.sort((a: any, b: any) =>
        a.createdAt && b.createdAt
          ? b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0
          : 0
      );
    }
  });



  // Compute eligible requisitions and remaining-by-item for dispatch UI
  const eligibleReqs = project.requisitions.filter((r: any) =>
    ['APPROVED', 'PARTIAL', 'PURCHASED', 'COMPLETED'].includes(r.status)
  ) as any[];

  // Only fetch verified GRN items (which means received and accepted into inventory)
  const reqIds = eligibleReqs.map((r) => r.id);
  const verifiedGrnItems =
    reqIds.length > 0
      ? await prisma.goodsReceivedNoteItem.findMany({
          where: {
            grn: {
              status: 'VERIFIED',
              purchaseOrder: { projectId: project.id },
            },
            poItem: {
              requisitionItem: { requisitionId: { in: reqIds } }
            },
          },
          select: {
            qtyAccepted: true,
            poItem: { select: { requisitionItemId: true } },
          },
        })
      : [];
  
  const dispatched = await prisma.dispatchItem.groupBy({
    by: ['requisitionItemId'],
    where: { requisitionItemId: { not: null }, dispatch: { projectId: project.id } },
    _sum: { qty: true } as any,
  });

  const verifiedByItem = new Map<string, number>();
  verifiedGrnItems.forEach((item) => {
    const rid = item.poItem?.requisitionItemId;
    if (rid) {
      verifiedByItem.set(rid, (verifiedByItem.get(rid) || 0) + item.qtyAccepted);
    }
  });
  
  const dispatchedByItem = new Map<string, number>();
  dispatched.forEach((d: any) => d.requisitionItemId && dispatchedByItem.set(d.requisitionItemId, Number(d._sum.qty ?? 0)));
  
  const remainingByItem = new Map<string, number>();
  eligibleReqs.forEach((req) => {
    if (req.items) {
      req.items.forEach((it: any) => {
        const verified = verifiedByItem.get(it.id) ?? 0;
        const sent = dispatchedByItem.get(it.id) ?? 0;
        remainingByItem.set(it.id, Math.max(0, verified - sent));
      });
    }
  });

  // Filter requisitions that have nothing remaining
  // const dispatchableReqs = eligibleReqs.filter((req) =>
  //   (req.items || []).some((it: any) => (remainingByItem.get(it.id) ?? 0) > 0)
  // );

  const dispatchableItems = eligibleReqs.flatMap((req) =>
    (req.items || []).map((it: any) => {
      const rem = remainingByItem.get(it.id) ?? 0;
      if (rem <= 0) return null;
      return {
        id: it.id,
        requisitionItemId: it.id,
        description: it.description,
        unit: it.unit || '-',
        qtyAvailable: rem,
        sourceLabel: `Req #${req.id.slice(-6)}`,
      };
    })
  ).filter((x) => x !== null) as any[];

  const isPM = role === 'PROJECT_MANAGER' || role === 'ADMIN';
  const isProc = role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT' || role === 'ADMIN';
  const isAccounts = role === 'SALES_ACCOUNTS' || (role as string).startsWith('ACCOUNT') || role === 'ADMIN';
  const canRecordPayments = role === 'SALES_ACCOUNTS' || role === 'ADMIN';
  const canViewFinancials = [
    'SALES',
    'SALES_ACCOUNTS',
    'ADMIN',
    'ACCOUNTS',
    'CASHIER',
    'ACCOUNTING_OFFICER',
    'ACCOUNTING_AUDITOR',
    'GENERAL_MANAGER',
    'MANAGING_DIRECTOR',
  ].includes(role);
  const canViewSchedule = ['PROJECT_MANAGER', 'SENIOR_PM', 'MANAGING_DIRECTOR', 'ADMIN'].includes(role);
  const isSalesAccountsOnly = role === 'SALES_ACCOUNTS';
  
  const sch = await prisma.paymentSchedule.findMany({ where: { projectId } });
  if (sch.length === 0) {
    try {
      await generatePaymentSchedule(projectId);
    } catch (e) {
      console.error('Failed to auto-generate payment schedule', e);
    }
  }

  const schedule = await prisma.paymentSchedule.findMany({
    where: { projectId },
    orderBy: [{ seq: 'asc' }],
  });
  
  // Find deposit item
  const depositItem = schedule.find(s => s.label === 'Deposit');
  // Check if fully paid (tolerant of slight mismatches if needed, but strict for now)
  const isDepositPaid = depositItem 
    ? (BigInt(depositItem.paidMinor ?? 0n) >= BigInt(depositItem.amountMinor))
    : true; // If no deposit row, assume no deposit needed/paid.

  const requiresDeposit = (project?.status === 'CREATED' || project?.status === 'DEPOSIT_PENDING') && !isDepositPaid;
  
  const depositLocked = !!requiresDeposit;
  const opsLocked = depositLocked || !hasSchedule;
  
  const totalDue = schedule.reduce((a, s) => a + BigInt(s.amountMinor), 0n);
  const totalPaid = schedule.reduce((a, s) => a + BigInt(s.paidMinor ?? 0), 0n);
  const bal = totalDue - totalPaid;
  
  const multipurposeInventory = await prisma.inventoryItem.findMany({
    where: { category: 'MULTIPURPOSE', qty: { gt: 0 } },
    orderBy: [{ name: 'asc' }, { description: 'asc' }],
    select: { id: true, name: true, description: true, unit: true, qty: true },
  });

  // Financial Snapshot Logic
  const firstFunding = (
    Array.isArray((project as any).requisitions)
      ? (project as any).requisitions.find((r: any) => r.funding?.status === 'APPROVED')?.funding
      : null
  ) as any;
  const totals = computeBalances({
    quote: project.quote as any,
    payments: project.clientPayments as any,
    funding: firstFunding ?? null,
  });
  const next = nextDueDate((project as any).installmentDueDay ?? null, project.commenceOn);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-blue-50 to-orange-50 p-6 rounded-lg border border-orange-200 shadow-sm">
        <div className="flex items-start gap-4">
          {/* Logo Placeholder - User can add actual image here */}
          {/* <div className="h-12 w-12 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold">B</div> */}
          
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">
                {project.quote?.customer?.displayName || 'Project'}
                {project.quote?.customer?.city ? ` - ${project.quote.customer.city}` : ''}
              </h1>
              <WorkflowStatusBadge status={project.status} />
            </div>
            <div className="mt-1 text-sm text-gray-500 space-y-1">
              <p>Ref: <span className="font-medium text-gray-900">{project.projectNumber || project.id}</span></p>
              <p>Commences: {new Date(project.commenceOn).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {canRecordPayments && (
            <Link
              href={`/projects/${projectId}/payments`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-6 py-2"
            >
              💰 Payments
            </Link>
          )}
          <Link href="/projects" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-orange-600 text-white shadow hover:bg-orange-700 h-9 px-6 py-2">
            ← Back to Projects
          </Link>
        </div>
      </header>

      {depositLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          Deposit not recorded yet. Project functions (schedule, requisitions, dispatches) unlock once status is PLANNED.
        </div>
      )}
      
      {!depositLocked && !hasSchedule && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">
          Project schedule not created yet. Please create a schedule to unlock requisitions and dispatches.
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {canViewFinancials && role !== 'SALES_ACCOUNTS' && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contract Value</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold"><Money minor={BigInt(Math.round(totals.contractTotal * 100))} /></div>
                <p className="text-xs text-muted-foreground">Total project value</p>
              </CardContent>
            </Card>
          </>
        )}
        {canViewFinancials && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contract Value</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold"><Money minor={BigInt(Math.round(totals.contractTotal * 100))} /></div>
                <p className="text-xs text-muted-foreground">Total project value</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid to Date</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600"><Money minor={BigInt(Math.round(totals.paid * 100))} /></div>
                <p className="text-xs text-muted-foreground">Received from client</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", totals.remaining > 0 ? "text-rose-600" : "text-gray-900")}>
                  <Money minor={BigInt(Math.round(totals.remaining * 100))} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Next due: {formatDateYMD(next)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispatches</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.dispatches.length}</div>
            <p className="text-xs text-muted-foreground">Total dispatches created</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue={tab || (isSalesAccountsOnly ? 'financials' : 'overview')} className="space-y-4">
        <TabsList>
          {!isSalesAccountsOnly && canViewSchedule && <TabsTrigger value="overview">Schedule of work</TabsTrigger>}
          {!isSalesAccountsOnly && <TabsTrigger value="procurement">Requisition Form</TabsTrigger>}
          {!isSalesAccountsOnly && <TabsTrigger value="logistics">Dispatch</TabsTrigger>}
          {!isSalesAccountsOnly && ['PM_CLERK', 'PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN'].includes(role) && (
            <>
              <TabsTrigger value="daily-tasks">Daily Tasks</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </>
          )}
          {canViewFinancials && <TabsTrigger value="financials">Financials</TabsTrigger>}
        </TabsList>

        {/* Schedule of Work Tab */}
        <TabsContent value="overview" className="space-y-4">
          {canViewSchedule && (
            <Card>
              <CardHeader>
                <CardTitle>Schedule of Work</CardTitle>
                <CardDescription>View or build the project schedule from the quote labour items.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-end gap-3">
                {hasSchedule ? (
                  <Link
                    href={`/projects/${projectId}/schedule`}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-orange-600 text-white shadow hover:bg-orange-700 h-9 px-4 py-2"
                  >
                    View Schedule
                  </Link>
                ) : (
                  <form
                    action={async () => {
                      'use server';
                      const res = await createScheduleFromQuote(projectId);
                      if (!(res as any).ok)
                        throw new Error((res as any).error || 'Failed to build schedule');
                      redirect(`/projects/${projectId}/schedule`);
                    }}
                  >
                    <SubmitButton
                      disabled={depositLocked}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-4 py-2"
                    >
                      {depositLocked ? 'Awaiting Deposit' : 'Create Schedule'}
                    </SubmitButton>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Procurement Tab */}
        <TabsContent value="procurement" className="space-y-4">
          {opsLocked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Procurement is disabled until the deposit is received and schedule is created.
            </div>
          )}
          {isPM && (
            <Card>
              <CardHeader>
                <CardTitle>Create Requisition</CardTitle>
                <CardDescription>
                  Build a requisition from the project quote lines and send it for procurement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Use the quote items to compose a requisition before requesting funding.
                  </p>
                  <Link
                    href={`/projects/${projectId}/requisitions/new`}
                    aria-disabled={opsLocked}
                    tabIndex={opsLocked ? -1 : 0}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2",
                      opsLocked ? "pointer-events-none opacity-50" : ""
                    )}
                  >
                    {depositLocked ? 'Awaiting Deposit' : !hasSchedule ? 'Create Schedule First' : 'Create from Quote'}
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Requisitions History</CardTitle>
            </CardHeader>
            <CardContent>
              {requisitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requisitions found.</p>
              ) : (
                <div className="space-y-4">
                  {requisitions.map((req) => {
                    const po = purchaseOrders.find((p) => p.requisitionId === req.id);
                    return (
                      <div key={req.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">Requisition {req.id.slice(0, 8)}</div>
                            <div className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</div>
                          </div>
                          <StatusBadge status={req.status} />
                        </div>
                        
                        <div className="mt-4 flex gap-2">
                          <Link
                            href={`/procurement/requisitions/${req.id}`}
                            className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1"
                          >
                            View Requisition
                          </Link>
                          
                          {po ? (
                            <Link
                              href={`/procurement/purchase-orders/${po.id}`}
                              className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-white shadow hover:bg-slate-900/90 h-8 px-3 py-1"
                            >
                              View PO ({po.status})
                            </Link>
                          ) : (
                            req.status === 'APPROVED' && isProc && (
                              <form
                                action={async (fd) => {
                                  'use server';
                                  await createPOFromRequisition(req.id, fd);
                                }}
                                className="flex gap-2 items-center"
                              >
                                <input
                                  name="vendor"
                                  placeholder="Vendor Name"
                                  required
                                  className="h-8 w-32 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <SubmitButton className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 py-1">
                                  Create PO
                                </SubmitButton>
                              </form>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logistics Tab */}
        <TabsContent value="logistics" className="space-y-4">
          {opsLocked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Dispatches are blocked until the deposit is received and schedule is created.
            </div>
          )}
          {isPM && (
            <Card>
              <CardHeader>
                <CardTitle>Create Dispatch</CardTitle>
                <CardDescription>Dispatch materials from approved requisitions or inventory.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Materials Dispatch Form */}
                {/* Dispatch Forms Per Requisition */}
                <div className="space-y-8">
                  <h3 className="text-sm font-semibold">From Verified Inventory (Requisitions)</h3>
                  <DispatchTableClient items={dispatchableItems} projectId={project.id} />
                </div>

                {/* Multipurpose Dispatch Form */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold">From Multipurpose Inventory</h3>
                  {multipurposeInventory.length > 0 ? (
                    <form
                      action={async (fd) => {
                        'use server';
                        const all = await prisma.inventoryItem.findMany({
                          where: { qty: { gt: 0 }, category: 'MULTIPURPOSE' },
                          select: { id: true, qty: true },
                        });
                        const items: { inventoryItemId: string; qty: number }[] = [];
                        for (const row of all) {
                          const raw = fd.get(`mpqty-${row.id}`);
                          if (!raw) continue;
                          const qty = Number(raw);
                          if (Number.isFinite(qty) && qty > 0) {
                            if (qty > Number(row.qty ?? 0)) {
                              throw new Error(`Qty exceeds available (${row.qty ?? 0}).`);
                            }
                            items.push({ inventoryItemId: row.id, qty });
                          }
                        }
                        if (items.length === 0) throw new Error('Enter at least one multipurpose qty.');
                        const res = await createDispatchFromSelectedInventory(projectId, items);
                        if (!(res as any).ok)
                          throw new Error((res as any).error || 'Failed to create dispatch');
                        redirect(`/projects/${projectId}/dispatches/${(res as any).dispatchId}`);
                      }}
                      className="space-y-4"
                    >
                      <div className="rounded-md border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">Item</th>
                              <th className="px-4 py-2 text-center font-medium">Unit</th>
                              <th className="px-4 py-2 text-right font-medium">In Stock</th>
                              <th className="px-4 py-2 text-right font-medium">Dispatch Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {multipurposeInventory.map((it) => (
                              <tr key={it.id} className="border-t">
                                <td className="px-4 py-2">{it.name ?? it.description}</td>
                                <td className="px-4 py-2 text-center">{it.unit ?? '-'}</td>
                                <td className="px-4 py-2 text-right">{Number(it.qty ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-2 text-right">
                                  <input
                                    name={`mpqty-${it.id}`}
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={Number(it.qty ?? 0)}
                                    placeholder="0"
                                    disabled={opsLocked}
                                    className="w-24 rounded-md border border-input bg-transparent px-2 py-1 text-right text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end">
                        <SubmitButton
                          disabled={opsLocked}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                        >
                          Dispatch Multipurpose
                        </SubmitButton>
                      </div>
                    </form>
                  ) : (
                    <p className="text-sm text-muted-foreground">No multipurpose items in stock.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Dispatches History</CardTitle>
            </CardHeader>
            <CardContent>
              {project.dispatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dispatches yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.dispatches.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 transition-colors">
                      <div>
                        <div className="font-medium">Dispatch {d.id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={d.status} />
                        <Link
                          href={`/projects/${d.projectId}/dispatches/${d.id}`}
                          className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Tasks Tab */}
        <TabsContent value="daily-tasks" className="space-y-4">
           <DailyTasksPage params={params} />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
           <ProjectReportsPage params={params} />
        </TabsContent>

        {/* Financials Tab */}
        {canViewFinancials && (
          <TabsContent value="financials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
                <CardDescription>Track client payments against the schedule.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Milestone</th>
                        <th className="px-4 py-2 text-left font-medium">Due Date</th>
                        <th className="px-4 py-2 text-right font-medium">Amount</th>
                        <th className="px-4 py-2 text-right font-medium">Paid</th>
                        <th className="px-4 py-2 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-4 py-2">{s.label}</td>
                          <td className="px-4 py-2">{new Date(s.dueOn).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-right"><Money minor={s.amountMinor} /></td>
                          <td className="px-4 py-2 text-right"><Money minor={s.paidMinor ?? 0n} /></td>
                          <td className="px-4 py-2 text-center">
                            <StatusBadge status={s.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {canRecordPayments && (
               <Card>
                 <CardHeader>
                   <CardTitle>Record Payment</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <form
                      action={async (fd) => {
                        'use server';
                        await recordClientPayment(projectId, {
                          type: fd.get('type') as any,
                          amount: Number(fd.get('amount') || 0),
                          receivedAt: String(fd.get('receivedAt') || new Date().toISOString().slice(0, 10)),
                          receiptNo: String(fd.get('receiptNo') || ''),
                          method: 'CASH',
                          attachmentUrl: null,
                        });
                      }}
                      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end"
                    >
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <select name="type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <option value="DEPOSIT">Deposit</option>
                          <option value="INSTALLMENT">Installment</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Amount</label>
                        <input name="amount" type="number" step="0.01" placeholder="0.00" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-sm font-medium">Date</label>
                         <input name="receivedAt" type="date" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-sm font-medium">Reference</label>
                         <input name="receiptNo" placeholder="Ref #" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                      </div>
                      <div className="md:col-span-2 lg:col-span-4">
                        <SubmitButton className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 w-full md:w-auto">
                          Record Payment
                        </SubmitButton>
                      </div>
                    </form>
                 </CardContent>
               </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
