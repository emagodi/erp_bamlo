import { Suspense } from 'react';
import RevenueChart from '@/app/ui/dashboard/revenue-chart';
import StatsCards from '@/app/ui/dashboard/stats-cards';
import RecentQuotes from '@/app/ui/dashboard/recent-quotes';
import { getCurrentUser } from '@/lib/auth';
import { fetchCardData, fetchRevenueData, fetchRecentQuotes } from '@/lib/dashboard';
import DashboardTabs from '@/app/ui/dashboard/DashboardTabs';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { fromMinor } from '@/helpers/money';
import Money from '@/components/Money';
import ViewQuoteButton from '@/components/ViewQuoteButton';
import { PlusIcon } from '@heroicons/react/24/outline';

async function PendingTasks({ userId, role, endDate, currentPage = 1 }: { userId: string; role: string; endDate?: string; currentPage?: number }) {
  // Parse date or use default (today)
  const end = endDate ? new Date(endDate) : new Date();
  
  // Set time to end of day
  end.setHours(23, 59, 59, 999);

  // For SALES_ACCOUNTS (and Admin), show payment schedules that are due on or before the date
  // DEBUG: Render role on screen to verify




  // Initialize collections
  let allPayments: any[] = [];
  let pendingGrnPos: any[] = [];
  let dispatchTasks: Array<{ type: 'PENDING_DISPATCH'; data: any; date: Date }> = [];
  let driverTasks: any[] = []; // Initialize driverTasks
  const roles = {
    PM: role === 'PROJECT_MANAGER' || role === 'ADMIN' || role === 'MANAGING_DIRECTOR',
    SALES_ACCOUNTS: role === 'SALES_ACCOUNTS' || role === 'ACCOUNTING_CLERK' || role === 'ADMIN' || role === 'MANAGING_DIRECTOR',
    ACCOUNTS: role === 'ACCOUNTS' || role === 'ACCOUNTING_CLERK' || role === 'ACCOUNTING_SECURITY' || role === 'ADMIN' || role === 'MANAGING_DIRECTOR',
    SECURITY: role === 'SECURITY' || role === 'ADMIN',
    DRIVER: role === 'DRIVER' || role === 'ADMIN',
    SENIOR_PM: role === 'SENIOR_PM' || role === 'ADMIN' || role === 'GENERAL_MANAGER' || role === 'MANAGING_DIRECTOR',
    SENIOR_QS: role === 'SENIOR_QS' || role === 'ADMIN' || role === 'GENERAL_MANAGER' || role === 'MANAGING_DIRECTOR',
    SALES: role === 'SALES' || role === 'ADMIN' || role === 'MANAGING_DIRECTOR',
    PROCUREMENT: role === 'PROCUREMENT' || role === 'SENIOR_PROCUREMENT' || role === 'ADMIN' || role === 'GENERAL_MANAGER' || role === 'MANAGING_DIRECTOR',
  };

  // Logic for Project Managers (Pending Dispatches)
  if (roles.PM) {
      const myProjects = await prisma.project.findMany({
          where: {
             ...(role === 'PROJECT_MANAGER' ? { assignedToId: userId } : {}),
             status: { not: 'COMPLETED' }
          },
          select: { id: true, projectNumber: true, quote: { select: { customer: true } } }
      });
      
      if (myProjects.length > 0) {
          const pIds = myProjects.map(p => p.id);
          
          // 1. Get all Verified GRN Items for these projects (Received Stock)
          const verifiedItems = await prisma.goodsReceivedNoteItem.findMany({
              where: {
                  grn: { status: 'VERIFIED', purchaseOrder: { projectId: { in: pIds } } }
              },
              select: { qtyAccepted: true, poItem: { select: { requisitionItemId: true } }, grn: { select: { purchaseOrder: { select: { projectId: true } } } } }
          });

          // 2. Get all Dispatched Items (Sent Stock)
          const dispatchedItems = await prisma.dispatchItem.findMany({
              where: {
                  dispatch: { projectId: { in: pIds } },
                  requisitionItemId: { not: null }
              },
              select: { qty: true, requisitionItemId: true, dispatch: { select: { projectId: true } } }
          });

          // 3. Aggregate by Project -> RequisitionItem
          const projMap = new Map<string, Map<string, { verified: number, sent: number }>>();
          
          verifiedItems.forEach(vi => {
              const pid = vi.grn.purchaseOrder.projectId;
              const rid = vi.poItem?.requisitionItemId;
              if (!rid) return;
              if (!projMap.has(pid)) projMap.set(pid, new Map());
              const pData = projMap.get(pid)!;
              if (!pData.has(rid)) pData.set(rid, { verified: 0, sent: 0 });
              pData.get(rid)!.verified += Number(vi.qtyAccepted);
          });

          dispatchedItems.forEach(di => {
             const pid = di.dispatch.projectId;
             const rid = di.requisitionItemId!;
             if (!projMap.has(pid)) return; 
             const pData = projMap.get(pid)!;
             if (!pData.has(rid)) pData.set(rid, { verified: 0, sent: 0 });
             pData.get(rid)!.sent += Number(di.qty);
          });

          // 4. Create Tasks for Projects with Remaining Items
          myProjects.forEach(proj => {
              const pData = projMap.get(proj.id);
              if (!pData) return;
              
              let pendingCount = 0;
              for (const vals of pData.values()) {
                  if (vals.verified > vals.sent) pendingCount++;
              }

              if (pendingCount > 0) {
                  dispatchTasks.push({
                      type: 'PENDING_DISPATCH',
                      data: { ...proj, pendingCount },
                      date: new Date()
                  });
              }
          });
      }
  }

  // Logic for Sales Accounts (Incoming Payments)
  if (roles.SALES_ACCOUNTS) {
    allPayments = await prisma.paymentSchedule.findMany({
      where: {
        dueOn: { lte: end },
        status: { not: 'PAID' },
      },
      include: {
        project: {
          select: {
            id: true,
            projectNumber: true,
            quote: { include: { customer: true } },
          },
        },
      },
      orderBy: { dueOn: 'asc' },
    });
  }

  // Logic for Accounts (GRNs & Funding Requests - Outgoing)
  let pendingFundingRequests: any[] = [];
  if (roles.ACCOUNTS) {
    pendingGrnPos = await prisma.purchaseOrder.findMany({
      where: {
        goodsReceivedNotes: { some: { status: 'PENDING' } },
      },
      include: {
        project: {
          select: {
            id: true,
            projectNumber: true,
            quote: { include: { customer: true } },
          },
        },
        goodsReceivedNotes: {
            select: { id: true, createdAt: true }
        }
      },
    });

    pendingFundingRequests = await prisma.fundingRequest.findMany({
        where: {
            status: 'REQUESTED'
        },
        include: {
            requisition: {
                select: {
                    id: true,
                    project: {
                        select: {
                            id: true,
                            projectNumber: true,
                            quote: { select: { customer: { select: { displayName: true } } } }
                        }
                    }
                }
            },
            requestedBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'asc' }
    });
  }


  // Logic for Security (Gate Pass & Incoming Deliveries)
  let securityOutgoing: any[] = [];
  let securityIncoming: any[] = [];

  if (roles.SECURITY) {
    // 1. Outgoing Dispatches (Gate Pass) - Dispatch created but not signed by security
    securityOutgoing = await prisma.dispatch.findMany({
      where: {
        securitySignedAt: null,
        status: { not: 'DRAFT' }, // Assuming PM moves it out of DRAFT or we just show all non-completed
        // actually, usually PM creates it. If status default is DRAFT, maybe we only show if it's explicitly 'READY' or we show all?
        // Let's assume for now we show all Dispatches that are created (exist) where security hasn't signed.
      },
      include: {
        project: {
          select: {
            projectNumber: true,
            quote: { select: { customer: { select: { displayName: true } } } }
          }
        },
        items: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Incoming Deliveries (Expected Stock) - POs that are Submitted
    securityIncoming = await prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['SUBMITTED', 'ORDERED', 'PURCHASED'] },
      },
      include: {
        project: {
            select: {
              projectNumber: true,
              quote: { select: { customer: { select: { displayName: true } } } }
            }
        },
        purchases: { select: { vendor: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // Logic for Driver (Pick up items)
  if (roles.DRIVER) {
      driverTasks = await prisma.dispatch.findMany({
          where: {
              status: 'DISPATCHED', // Items handed out, waiting for driver pickup
              driverSignedAt: null,
              OR: [
                  { assignedToDriverId: userId },
                  { assignedToDriverId: null }
              ]
          },
          include: {
              project: {
                  select: {
                      projectNumber: true,
                      quote: { select: { customer: { select: { displayName: true } } } }
                  }
              },
              items: { select: { id: true, qty: true, unit: true, description: true } }
          },
         orderBy: { createdAt: 'desc' }
      });
  }

  // Logic for Senior PM (Project Assignment)
  let assignmentTasks: any[] = [];
  if (roles.SENIOR_PM) {
     assignmentTasks = await prisma.project.findMany({
         where: {
             status: { notIn: ['CREATED', 'COMPLETED', 'CLOSED'] }, // Unlocked and not finished
             assignedToId: null, // Unassigned
         },
         include: {
             quote: { select: { customer: { select: { displayName: true } } } }
         },
         orderBy: { createdAt: 'desc' }
     });
  }

  // Logic for Project Manager (My Assigned Projects)
  let myProjectTasks: any[] = [];
  if (roles.PM) {
      myProjectTasks = await prisma.project.findMany({
          where: {
              assignedToId: userId,
              status: { notIn: ['COMPLETED', 'CLOSED'] }
          },
          include: {
              quote: { select: { customer: { select: { displayName: true } } } }
          },
          orderBy: { createdAt: 'desc' }
      });
  }

  // Logic for Senior QS (Quote Reviews)
  let quoteReviews: any[] = [];
  let negotiationReviews: any[] = [];
  if (roles.SENIOR_QS) {
      // 1. New Quotes needing review
      quoteReviews = await prisma.quote.findMany({
          where: { status: 'SUBMITTED_REVIEW' },
          include: { customer: { select: { displayName: true } } },
          orderBy: { updatedAt: 'desc' }
      });

      // 2. Negotiations needing review (Sales Proposals)
      negotiationReviews = await prisma.quote.findMany({
          where: {
              status: { in: ['NEGOTIATION', 'SENT_TO_SALES'] },
              negotiations: {
                  some: {
                      status: 'OPEN',
                      items: { some: { status: 'PENDING' } }
                  }
              }
          },
          include: { customer: { select: { displayName: true } } },
      });
  }

  // Logic for Sales (Pending Actions)
  let salesTasks: any[] = [];
  if (roles.SALES) {
      salesTasks = await prisma.quote.findMany({
          where: {
              status: { in: ['SENT_TO_SALES', 'NEGOTIATION', 'REVIEWED'] }
          },
          include: { customer: { select: { displayName: true } } },
          orderBy: { updatedAt: 'desc' }
      });
  }

  // Logic for Procurement (Pending Requisitions)
  let procurementTasks: any[] = [];
  if (roles.PROCUREMENT) {
      procurementTasks = await prisma.procurementRequisition.findMany({
          where: {
              status: { in: ['SUBMITTED', 'APPROVED'] },
              funding: {
                  none: {
                      status: 'REQUESTED' // Exclude those waiting for funding approval
                  }
              }
          },
          include: {
              project: {
                  select: {
                      projectNumber: true,
                      quote: { select: { customer: { select: { displayName: true } } } }
                  }
              },
              items: { select: { id: true } } // needed for count
          },
          orderBy: { createdAt: 'desc' }
      });
  }

  pendingGrnPos.sort((a, b) => {
      const getLastActivity = (po: typeof pendingGrnPos[0]) => {
          const grnNotetimestamps = po.goodsReceivedNotes.map((g: any) => g.createdAt.getTime());
          return Math.max(po.updatedAt.getTime(), ...grnNotetimestamps);
      };
      return getLastActivity(b) - getLastActivity(a);
  });

  // Sort payments by priority
  const sortedPayments = allPayments.sort((a: any, b: any) => {
    const statusOrder: Record<string, number> = { DUE: 0, PARTIAL: 1, PAID: 2 };
    return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
  });

  // Combine tasks (GRNs first as they are blocking operations usually)
  const allTasks = [
    ...pendingFundingRequests.map(f => ({ type: 'FUNDING_REQUEST' as const, data: f, date: f.createdAt })),
    ...pendingGrnPos.map(po => ({ type: 'GRN_VERIFICATION' as const, data: po, date: po.updatedAt })),
    ...sortedPayments.map(p => ({ type: 'PAYMENT' as const, data: p, date: p.dueOn })),
    ...myProjectTasks.map(p => ({ type: 'MY_PROJECT' as const, data: p, date: p.createdAt })),
    ...dispatchTasks,
    ...securityOutgoing.map(d => ({ type: 'SECURITY_OUTGOING' as const, data: d, date: d.createdAt })),
    ...securityIncoming.map(po => ({ type: 'SECURITY_INCOMING' as const, data: po, date: po.createdAt })),
    ...driverTasks.map(d => ({ type: 'DRIVER_TASK' as const, data: d, date: new Date(d.createdAt) })),
    ...assignmentTasks.map(p => ({ type: 'PROJECT_ASSIGNMENT' as const, data: p, date: p.createdAt })),
    ...quoteReviews.map(q => ({ type: 'QUOTE_REVIEW' as const, data: q, date: q.updatedAt })),
    ...negotiationReviews.map(q => ({ type: 'NEGOTIATION_REVIEW' as const, data: q, date: q.updatedAt })),
    ...salesTasks.map(q => ({ type: 'SALES_TASK' as const, data: q, date: q.updatedAt })),
    ...procurementTasks.map(r => ({ type: 'PROCUREMENT_TASK' as const, data: r, date: r.createdAt }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Pagination logic
    const itemsPerPage = 5;
    const totalItems = allTasks.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = allTasks.slice(startIndex, startIndex + itemsPerPage);



    return (
      <div className="rounded-lg bg-white p-6 shadow">

        <h3 className="text-lg font-medium leading-6 text-gray-900">Pending Tasks</h3>
        <p className="mt-1 text-sm text-gray-500">
           {pendingGrnPos.length > 0 ? `${pendingGrnPos.length} GRNs to verify. ` : ''} 
           Overview of your pending actions and assignments.
        </p>
        <div className="mt-4">
          {paginatedItems.length > 0 ? (
            <div className="space-y-3">
              {paginatedItems.map((item) => {
                 if (item.type === 'PENDING_DISPATCH') {
                    const data = item.data as any; // { id, projectNumber, quote: { customer }, pendingCount }
                    return (
                     <div key={`pending-dispatch-${data.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-barmlo-blue/50 transition-all border-l-4 border-l-barmlo-blue">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                             <p className="text-sm font-medium text-gray-900">
                               {data.quote?.customer?.displayName || 'Unknown Customer'}
                             </p>
                             <p className="text-xs text-gray-500 mt-1">
                               {data.pendingCount} Item{data.pendingCount !== 1 ? 's' : ''} Ready for Dispatch
                             </p>
                             <p className="text-xs text-gray-500">
                               Project: {data.projectNumber || 'N/A'}
                             </p>
                          </div>
                          <div className="text-right ml-4 flex items-center gap-3">
                             <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-barmlo-blue/10 text-barmlo-blue">
                               DISPATCH
                             </span>
                             <Link
                               href={`/projects/${data.id}?tab=logistics`}
                               className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-barmlo-blue hover:bg-barmlo-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-barmlo-blue"
                             >
                               Create Dispatch
                             </Link>
                          </div>
                        </div>
                     </div>
                    );
                 }

                 if (item.type === 'GRN_VERIFICATION') {
                   const po = item.data as any; // Type assertion since we mixed types
                   const pendingCount = po.goodsReceivedNotes?.length ?? 0;
                   return (
                     <div key={`po-${po.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-emerald-300 transition-all border-l-4 border-l-amber-400">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                             <p className="text-sm font-medium text-gray-900">
                               {po.project?.quote?.customer?.displayName || 'Unknown Customer'}
                             </p>
                             <p className="text-xs text-gray-500 mt-1">
                               PO #{po.id.slice(0, 8)} • {pendingCount} Pending GRN{pendingCount !== 1 ? 's' : ''}
                             </p>
                             <p className="text-xs text-gray-500">
                               Project: {po.project?.projectNumber || 'N/A'}
                             </p>
                          </div>
                          <div className="text-right ml-4 flex items-center gap-3">
                             <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                               VERIFY GRN
                             </span>
                             <Link
                               href={`/procurement/purchase-orders/${po.id}`}
                               className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                             >
                               Verify
                             </Link>
                          </div>
                        </div>
                     </div>
                   );
                }

                if (item.type === 'DRIVER_TASK') {
                    const d = item.data as any;
                    return (
                        <div key={`driver-${d.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-emerald-300 transition-all border-l-4 border-l-emerald-400">
                             <div className="flex items-center justify-between">
                                 <div className="flex-1">
                                     <p className="text-sm font-medium text-gray-900">
                                         Ready for Pickup #{d.id.slice(-6).toUpperCase()}
                                     </p>
                                     <p className="text-xs text-gray-500 mt-1">
                                        {d.project?.quote?.customer?.displayName} • {d.items.length} Items
                                     </p>
                                     <p className="text-xs text-gray-500">
                                         Project: {d.project?.projectNumber}
                                     </p>
                                 </div>
                                 <div className="text-right ml-4 flex items-center gap-3">
                                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                         PICKUP
                                     </span>
                                     <Link
                                         href={`/dispatches/${d.id}`}
                                         className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                                     >
                                         Inspect
                                     </Link>
                                 </div>
                             </div>
                        </div>
                    );
                }



                if (item.type === 'SECURITY_OUTGOING') {
                    const d = item.data as any;
                    const itemCount = d.items?.length || 0;
                    return (
                        <div key={`sec-out-${d.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-red-300 transition-all border-l-4 border-l-red-400">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                        Outgoing Dispatch #{d.id.slice(-6).toUpperCase()}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {d.project?.quote?.customer?.displayName} • {itemCount} Items
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Project: {d.project?.projectNumber}
                                    </p>
                                </div>
                                <div className="text-right ml-4 flex items-center gap-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        GATE PASS
                                    </span>
                                    <Link
                                        href={`/dispatches/${d.id}`}
                                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    >
                                        Inspect
                                    </Link>
                                </div>
                            </div>
                        </div>
                    );
                }

                if (item.type === 'SECURITY_INCOMING') {
                    const po = item.data as any;
                    const vendorName = po.purchases?.[0]?.vendor || 'Unknown Vendor';
                    return (
                        <div key={`sec-in-${po.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-all border-l-4 border-l-blue-400">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                        Expected Delivery from {vendorName}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        PO #{po.id.slice(0, 8)} • {po.project?.quote?.customer?.displayName}
                                    </p>
                                </div>
                                <div className="text-right ml-4 flex items-center gap-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        RECEIVE
                                    </span>
                                    <Link
                                        href={`/procurement/purchase-orders/${po.id}`}
                                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    >
                                        Log Receipt
                                    </Link>
                                </div>
                            </div>
                        </div>
                    );
                }

                if (item.type === 'PROJECT_ASSIGNMENT') {
                    const p = item.data as any;
                    return (
                         <div key={`assign-${p.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-orange-300 transition-all border-l-4 border-l-orange-400">
                             <div className="flex items-center justify-between">
                                 <div className="flex-1">
                                     <p className="text-sm font-medium text-gray-900">
                                          Assign Project Manager
                                     </p>
                                     <p className="text-xs text-gray-500 mt-1">
                                          {p.quote?.customer?.displayName || 'Unknown Customer'}
                                     </p>
                                     <p className="text-xs text-gray-500">
                                          Project: {p.projectNumber || 'N/A'} • Unlocked & Ready
                                     </p>
                                 </div>
                                 <div className="text-right ml-4 flex items-center gap-3">
                                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                          ASSIGN PM
                                     </span>
                                      <Link
                                          href="/projects?tab=assignment"
                                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                                     >
                                          Assign
                                     </Link>
                                 </div>
                             </div>
                         </div>
                    );
                }

                if (item.type === 'MY_PROJECT') {
                    const p = item.data as any;
                    return (
                        <div key={`myproj-${p.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-all border-l-4 border-l-blue-400">
                             <div className="flex items-center justify-between">
                                 <div className="flex-1">
                                     <p className="text-sm font-medium text-gray-900">
                                          Project Assignment
                                     </p>
                                     <p className="text-xs text-gray-500 mt-1">
                                          {p.quote?.customer?.displayName || 'Unknown Customer'}
                                     </p>
                                     <p className="text-xs text-gray-500">
                                          Ref: {p.projectNumber || 'N/A'} • {p.status}
                                     </p>
                                 </div>
                                 <div className="text-right ml-4 flex items-center gap-3">
                                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          YOUR PROJECT
                                     </span>
                                     <Link
                                          href={`/projects/${p.id}`}
                                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                     >
                                          View
                                     </Link>
                                 </div>
                             </div>
                        </div>
                    );
                }

                if (item.type === 'QUOTE_REVIEW') {
                    const q = item.data as any;
                    return (
                        <div key={`qreview-${q.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-violet-300 transition-all border-l-4 border-l-violet-400">
                             <div className="flex items-center justify-between">
                                 <div className="flex-1">
                                     <p className="text-sm font-medium text-gray-900">
                                          Review New Quote
                                     </p>
                                     <p className="text-xs text-gray-500 mt-1">
                                          {q.customer?.displayName || 'Unknown Customer'}
                                     </p>
                                     <p className="text-xs text-gray-500">
                                          Submitted for initial review
                                     </p>
                                 </div>
                                 <div className="text-right ml-4">
                                     <Link
                                          href={`/quotes/${q.id}`}
                                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
                                     >
                                          Review
                                     </Link>
                                 </div>
                             </div>
                        </div>
                    );
                }

                if (item.type === 'NEGOTIATION_REVIEW') {
                    const q = item.data as any;
                    return (
                        <div key={`nreview-${q.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-indigo-300 transition-all border-l-4 border-l-indigo-400">
                             <div className="flex items-center justify-between">
                                 <div className="flex-1">
                                     <p className="text-sm font-medium text-gray-900">
                                          Sales Proposal Review
                                     </p>
                                     <p className="text-xs text-gray-500 mt-1">
                                          {q.customer?.displayName || 'Unknown Customer'}
                                     </p>
                                     <p className="text-xs text-gray-500">
                                          Sales requested changes
                                     </p>
                                 </div>
                                 <div className="text-right ml-4">
                                     <Link
                                          href={`/quotes/${q.id}`}
                                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                     >
                                          Review
                                     </Link>
                                 </div>
                             </div>
                        </div>
                    );
                }

                if (item.type === 'FUNDING_REQUEST') {
                    const req = item.data as any;
                    const amount = req.amountMinor ? Number(req.amountMinor) / 100 : 0;
                    return (
                        <div key={`fund-${req.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-emerald-300 transition-all border-l-4 border-l-emerald-400">
                             <div className="flex items-center justify-between">
                                 <div className="flex-1">
                                     <p className="text-sm font-medium text-gray-900">
                                          Funding Request
                                     </p>
                                     <p className="text-xs text-gray-500 mt-1">
                                          {req.requisition?.project?.quote?.customer?.displayName || 'Unknown Customer'} • Requested by {req.requestedBy?.name || 'Unknown'}
                                     </p>
                                     <p className="text-xs text-gray-500">
                                          Project: {req.requisition?.project?.projectNumber || 'N/A'} • <Money minor={req.amountMinor} />
                                     </p>
                                 </div>
                                 <div className="text-right ml-4 flex items-center gap-3">
                                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                          APPROVE
                                     </span>
                                     <Link
                                          href={`/procurement/requisitions/${req.requisitionId}`}
                                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                                     >
                                          Review
                                     </Link>
                                 </div>
                             </div>
                        </div>
                    );
                }

                if (item.type === 'PROCUREMENT_TASK') {
                    const req = item.data as any; // { id, project: { projectNumber, quote: { customer } }, items: [] }
                    const itemCount = req.items?.length || 0;
                    return (
                        <div key={`proc-${req.id}`} className="block rounded-lg border border-gray-200 p-4 hover:border-pink-300 transition-all border-l-4 border-l-pink-400">
                             <div className="flex items-center justify-between">
                                 <div className="flex-1">
                                     <p className="text-sm font-medium text-gray-900">
                                          Requisition #{req.id.slice(-6).toUpperCase()}
                                     </p>
                                     <p className="text-xs text-gray-500 mt-1">
                                          {req.project?.quote?.customer?.displayName || 'Unknown Customer'} • {itemCount} Items
                                     </p>
                                     <p className="text-xs text-gray-500">
                                          Project: {req.project?.projectNumber || 'N/A'} • Needs PO
                                     </p>
                                 </div>
                                 <div className="text-right ml-4 flex items-center gap-3">
                                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                                          ORDER
                                     </span>
                                     <Link
                                          href={`/procurement/requisitions/${req.id}`}
                                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                                     >
                                          View Requisition
                                     </Link>
                                 </div>
                             </div>
                        </div>
                    );
                }

                if (item.type === 'SALES_TASK') {
                    const q = item.data as any;
                    let label = 'Action Needed';
                    let desc = 'Requires attention';
                    let colorClass = 'border-l-cyan-400 hover:border-cyan-300';
                    let btnColor = 'bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500';

                    if (q.status === 'SENT_TO_SALES') {
                        label = 'New Lead / Quote';
                        desc = 'Ready for sales engagement';
                        colorClass = 'border-l-emerald-400 hover:border-emerald-300';
                        btnColor = 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500';
                    } else if (q.status === 'NEGOTIATION') {
                        label = 'Active Negotiation';
                        desc = 'Proposal under review';
                        colorClass = 'border-l-amber-400 hover:border-amber-300';
                        btnColor = 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
                    } else if (q.status === 'REVIEWED') {
                        label = 'Ready for Endorsement';
                        desc = 'Quote reviewed and finalized';
                        colorClass = 'border-l-blue-400 hover:border-blue-300';
                        btnColor = 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
                    }

                    return (
                        <div key={`sales-${q.id}`} className={`block rounded-lg border border-gray-200 p-4 transition-all border-l-4 ${colorClass}`}>
                             <div className="flex items-center justify-between">
                                 <div className="flex-1">
                                     <p className="text-sm font-medium text-gray-900">
                                          {label}
                                     </p>
                                     <p className="text-xs text-gray-500 mt-1">
                                          {q.customer?.displayName || 'Unknown Customer'}
                                     </p>
                                     <p className="text-xs text-gray-500">
                                          {desc}
                                     </p>
                                 </div>
                                 <div className="text-right ml-4">
                                     <Link
                                          href={`/quotes/${q.id}`}
                                          className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${btnColor}`}
                                     >
                                          View
                                     </Link>
                                 </div>
                             </div>
                        </div>
                    );
                }

                const payment = item.data as any;
                const amountDue = Number(payment.amountMinor) - Number(payment.paidMinor);
                const isDeposit = payment.label?.toLowerCase().includes('deposit');
                const canTakeAction = payment.status === 'DUE' || payment.status === 'PARTIAL';
                
                // Build URL with pre-filled form data as query params
                const amountInDollars = (amountDue / 100).toFixed(2);
                const paymentType = isDeposit ? 'deposit' : 'installment';
                const paymentUrl = `/projects/${payment.projectId}/payments?amount=${amountInDollars}&type=${paymentType}`;
                
                return (
                  <div
                    key={payment.id}
                    className="block rounded-lg border border-gray-200 p-4 hover:border-emerald-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {payment.project?.quote?.customer?.displayName || 'Unknown Customer'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {payment.label} • Due: {new Date(payment.dueOn).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Project: {payment.project?.projectNumber || 'Number pending'}
                        </p>
                      </div>
                      <div className="text-right ml-4 flex items-center gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            <Money minor={BigInt(amountDue)} />
                          </p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            payment.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            payment.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                        {canTakeAction && (
                          <Link
                            href={paymentUrl}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                          >
                            Record Payment
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-4">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <Link
                      href={`/dashboard?page=${Math.max(1, currentPage - 1)}${endDate ? `&endDate=${endDate}` : ''}`}
                      className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
                    >
                      Previous
                    </Link>
                    <Link
                      href={`/dashboard?page=${Math.min(totalPages, currentPage + 1)}${endDate ? `&endDate=${endDate}` : ''}`}
                      className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
                    >
                      Next
                    </Link>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of <span className="font-medium">{totalItems}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <Link
                          href={`/dashboard?page=${Math.max(1, currentPage - 1)}${endDate ? `&endDate=${endDate}` : ''}`}
                          className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                          </svg>
                        </Link>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <Link
                            key={p}
                            href={`/dashboard?page=${p}${endDate ? `&endDate=${endDate}` : ''}`}
                            className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                              p === currentPage
                                ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
                                : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0'
                            }`}
                          >
                            {p}
                          </Link>
                        ))}
                        <Link
                          href={`/dashboard?page=${Math.min(totalPages, currentPage + 1)}${endDate ? `&endDate=${endDate}` : ''}`}
                          className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                          </svg>
                        </Link>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No pending tasks at the moment.
            </div>
          )}
        </div>
      </div>
    );
  }



async function RecentProjects() {
  const projects = await prisma.project.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      quote: {
        include: {
          customer: true,
          lines: true, // Include lines for total calculation
        },
      },
    },
  });

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Projects</h3>
        <Link href="/projects" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          View all →
        </Link>
      </div>
      {projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project) => {
            const totalMinor = project.quote?.lines?.reduce((sum: number, line: any) => sum + Number(line.lineTotalMinor || 0), 0) || 0;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-lg border border-gray-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {project.quote?.customer?.displayName || 'Unknown Customer'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Ref: {project.projectNumber || project.id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-semibold text-gray-900">
                      <Money minor={BigInt(totalMinor)} />
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500">No projects yet.</p>
      )}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ endDate?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.id || !user?.role) {
    return <div className="p-6">Please log in.</div>;
  }

  // Simplified QS Dashboard
  if (user.role === 'QS') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-6">
        <div className="text-center">
          <p className="text-xl text-gray-600">
            Welcome back, {user.name}.
          </p>
        </div>
        
        <Link 
          href="/quotes/new" 
          className="inline-flex w-full max-w-3xl justify-center items-center gap-4 rounded-2xl bg-orange-500 px-8 py-10 text-3xl font-bold text-white shadow-lg transition-all hover:bg-orange-600 hover:shadow-xl hover:-translate-y-1"
        >
           <PlusIcon className="h-10 w-10" />
           Create New Quotation
        </Link>
      </div>
    );
  }

  // Simplified Senior QS Dashboard
  if (user.role === 'SENIOR_QS') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-6">
        <div className="text-center">
          <p className="text-xl text-gray-600">
            Welcome back, {user.name}.
          </p>
        </div>
        
        <Link 
               href="/quotes" 
               className="inline-flex w-full max-w-3xl justify-center items-center gap-4 rounded-2xl bg-orange-500 px-8 py-10 text-3xl font-bold text-white shadow-lg transition-all hover:bg-orange-600 hover:shadow-xl hover:-translate-y-1"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Review Quotations
             </Link>
      </div>
    );
  }

  // Simplified Sales Dashboard
  if (user.role === 'SALES') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-6">
        <div className="text-center">
          <p className="text-xl text-gray-600">
            Welcome back, {user.name}.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl justify-center">
            <Link 
              href="/quotes?status=SENT_TO_SALES" 
              className="flex-1 inline-flex justify-center items-center gap-4 rounded-2xl bg-orange-500 px-8 py-10 text-2xl font-bold text-white shadow-lg transition-all hover:bg-orange-600 hover:shadow-xl hover:-translate-y-1"
            >
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10">
                 <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
               </svg>
               New Quotations
            </Link>

            <Link 
              href="/quotes?status=REVIEWED" 
              className="flex-1 inline-flex justify-center items-center gap-4 rounded-2xl bg-orange-500 px-8 py-10 text-2xl font-bold text-white shadow-lg transition-all hover:bg-orange-600 hover:shadow-xl hover:-translate-y-1"
            >
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10">
                 <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                 <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v0Z" />
                 <path strokeWidth="1.5" d="M9 12h6M9 16h6" />
               </svg>
               Pending Endorsements
            </Link>
        </div>
      </div>
    );
  }

  const { endDate, page } = await searchParams;
  const currentPage = Number(page) || 1;
  const today = new Date().toISOString().slice(0, 10);

  const [cardData, revenueData, recentQuotes] = await Promise.all([
    fetchCardData(),
    fetchRevenueData(),
    fetchRecentQuotes()
  ]);

  const isAdminOrMD = user.role === 'ADMIN' || user.role === 'MANAGING_DIRECTOR';
  const showQuotes = ['QS', 'SENIOR_QS', 'SALES'].includes(user.role);

  const tabs = [];

  if (!isAdminOrMD) {
    tabs.push({
      id: 'pending',
      label: 'Pending Tasks',
      content: (
        <div className="space-y-4">
          {user.role === 'SALES_ACCOUNTS' && (
            <div className="rounded-lg bg-white p-4 shadow border border-gray-200">
              <form action="/dashboard" method="get" className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Before
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={endDate || today}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium shadow hover:bg-emerald-700 transition-colors"
                >
                  Filter
                </button>
              </form>
            </div>
          )}
          <PendingTasks userId={user.id} role={user.role} endDate={endDate} currentPage={currentPage} />
        </div>
      )
    });

    tabs.push({
      id: 'overview',
      label: 'Projects & Quotations',
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-8">
              <RevenueChart data={revenueData} />
            </div>
            <div>
              {showQuotes ? (
                <RecentQuotes quotes={recentQuotes} />
              ) : (
                <RecentProjects />
              )}
            </div>
          </div>
        </div>
      )
    });
  } else {
    // Admin/MD view

    // Insert Pending Tasks for Admin/MD too
    tabs.push({
      id: 'pending',
      label: 'Pending Tasks',
      content: (
        <div className="space-y-4">
          <PendingTasks userId={user.id} role={user.role} endDate={endDate} currentPage={currentPage} />
        </div>
      )
    });

    tabs.push({
      id: 'projects',
      label: 'Projects',
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-8">
              <RevenueChart data={revenueData} />
            </div>
            <div>
              <RecentProjects />
            </div>
          </div>
        </div>
      )
    });

    tabs.push({
      id: 'quotations',
      label: 'Quotations',
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-8">
              <RevenueChart data={revenueData} />
            </div>
            <div>
              <RecentQuotes quotes={recentQuotes} />
            </div>
          </div>
        </div>
      )
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome back, {user.name}. Here's what's happening today.
        </p>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <StatsCards
          role={user.role}
          totalRevenue={cardData.totalRevenue}
          activeCustomers={cardData.numberOfCustomers}
          pendingQuotes={cardData.numberOfPendingQuotes}
          totalQuotes={cardData.numberOfQuotes}
          pendingProjects={cardData.numberOfPendingProjects}
          totalProjects={cardData.numberOfProjects}
        />
      </Suspense>

      <DashboardTabs tabs={tabs} />
    </div>
  );
}
