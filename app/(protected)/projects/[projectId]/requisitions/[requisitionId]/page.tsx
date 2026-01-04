// app/(protected)/projects/[projectId]/requisitions/[requisitionId]/page.tsx
import { prisma } from '@/lib/db';
import { fromMinor } from '@/helpers/money';
import Money from '@/components/Money';
import { getCurrentUser } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { submitRequisitionToProcurement } from '@/app/(protected)/projects/actions';
import Link from 'next/link';
import SubmitButton from '@/components/SubmitButton';

export default async function ProjectRequisitionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; requisitionId: string }>;
}) {
  const { projectId, requisitionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const req = await prisma.procurementRequisition.findUnique({
    where: { id: requisitionId },
    include: {
      items: {
        include: {
          quoteLine: { select: { metaJson: true } },
        },
      },
      project: { include: { quote: { select: { number: true } } } },
      submittedBy: { select: { name: true } },
    },
  });

  if (!req) return notFound();
  if (req.projectId !== projectId) return notFound();

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
  const canSubmit = req.status === 'DRAFT' && ['PROJECT_MANAGER', 'SENIOR_PM', 'ADMIN', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER'].includes(user.role as string);
  const showEstPrice = user.role !== 'PROJECT_MANAGER';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Requisition Details</h1>
          <div className="text-sm text-gray-600 mt-2">
            <div>
              <span className="font-medium">Requisition ID:</span> {req.id}
            </div>
            <div>
              <span className="font-medium">Project:</span> {req.project?.projectNumber || req.projectId}
            </div>
            <div>
              <span className="font-medium">Quote:</span> {req.project?.quote?.number ?? '-'}
            </div>
            <div>
              <span className="font-medium">Status:</span>{' '}
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                  req.status === 'DRAFT'
                    ? 'bg-gray-100 text-gray-800'
                    : req.status === 'SUBMITTED'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                }`}
              >
                {req.status}
              </span>
            </div>
            {req.submittedBy && (
              <div>
                <span className="font-medium">Submitted by:</span> {req.submittedBy.name}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projects/${projectId}`}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Project
          </Link>
          {canSubmit && (
            <form action={submitRequisitionToProcurement.bind(null, requisitionId)}>
              <SubmitButton
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm"
                loadingText="Submitting..."
              >
                Submit to Procurement
              </SubmitButton>
            </form>
          )}
          {!canSubmit && req.status === 'DRAFT' && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm text-yellow-800">
              Only Project Managers can submit requisitions
            </div>
          )}
          {req.status === 'SUBMITTED' && (
            <Link
              href={`/procurement/requisitions/${requisitionId}`}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              View in Procurement
            </Link>
          )}
        </div>
      </div>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Requisition Items</h2>
        <div className="space-y-6">
          {groupedItemEntries.map(([section, items]) => (
            <div key={section}>
              <h3 className="text-base font-semibold text-gray-700 mb-2 uppercase">{section}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Requested Qty</th>
                      {showEstPrice && <th className="px-3 py-2 text-right">Est. Price</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2">{it.description}</td>
                        <td className="px-3 py-2">{it.unit ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{Number(it.qtyRequested ?? 0)}</td>
                        {showEstPrice && (
                          <td className="px-3 py-2 text-right">
                            <Money value={fromMinor(BigInt(it.amountMinor ?? 0))} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        {showEstPrice && (
          <div className="mt-4 flex justify-end border-t pt-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">Total Estimated Cost</div>
              <div className="text-2xl font-bold text-gray-900">
                <Money value={grand} />
              </div>
            </div>
          </div>
        )}
      </section>

      {req.status === 'DRAFT' && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Draft Requisition</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  This requisition is in draft status. Review the items above and click &quot;Submit to
                  Procurement&quot; when ready to send it for approval.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
