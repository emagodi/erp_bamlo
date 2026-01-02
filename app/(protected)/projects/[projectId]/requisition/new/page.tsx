// // app/(protected)/projects/[projectId]/requisitions/new/page.tsx
// import { prisma } from '@/lib/db';
// import { getCurrentUser } from '@/lib/auth';
// import { redirect } from 'next/navigation';

// function fmtUnit(u?: string | null) {
//   return u && u.trim().length ? u : '-';
// }

// export default async function NewRequisitionPage({
//   params,
// }: {
//   params: Promise<{ projectId: string }>;
// }) {
//   const { projectId } = await params;
//   const me = await getCurrentUser();
//   if (!me) return <div className="p-6">Authentication required.</div>;

//   const project = await prisma.project.findUnique({
//     where: { id: projectId },
//     include: {
//       quote: {
//         include: {
//           lines: {
//             orderBy: { createdAt: 'asc' },
//             select: {
//               id: true,
//               description: true,
//               unit: true,
//               quantity: true, // quote quantity
//               unitPriceMinor: true, // used to compute amount
//             },
//           },
//         },
//       },
//     },
//   });
//   if (!project?.quote) return <div className="p-6">Project or Quote not found.</div>;

//   const lines = project.quote.lines;

//   // -- server action: read chosen lines, compute amountMinor = qty * unitPriceMinor, capture unit --
//   const createAction = async (fd: FormData) => {
//     'use server';

//     // Re-fetch inside action (don’t trust client)
//     const fresh = await prisma.project.findUnique({
//       where: { id: projectId },
//       include: {
//         quote: {
//           include: {
//             lines: {
//               select: {
//                 id: true,
//                 description: true,
//                 unit: true,
//                 quantity: true,
//                 unitPriceMinor: true,
//               },
//             },
//           },
//         },
//       },
//     });
//     if (!fresh?.quote) throw new Error('Project/Quote not found');

//     const selected: {
//       quoteLineId: string;
//       qty: number;
//     }[] = [];

//     for (const ln of fresh.quote.lines) {
//       if (fd.get(`pick-${ln.id}`)) {
//         const qty = Number(fd.get(`qty-${ln.id}`) ?? ln.quantity ?? 0);
//         if (!(qty > 0)) continue;
//         selected.push({ quoteLineId: ln.id, qty });
//       }
//     }

//     if (selected.length === 0) {
//       throw new Error('Pick at least one line');
//     }

//     // Build items with computed amount & unit from the quote line
//     const itemsData = selected.map((sel) => {
//       const ln = fresh.quote!.lines.find((x) => x.id === sel.quoteLineId)!;
//       const amountMinor =
//         (BigInt(ln.unitPriceMinor ?? 0) * BigInt(Math.round(sel.qty * 100))) / 100n; // qty * price
//       // If your qty is real-numbered, the multiply then /100 trick keeps cents aligned.
//       return {
//         description: ln.description,
//         unit: ln.unit ?? null,
//         qtyRequested: sel.qty,
//         amountMinor, // computed; no manual amount input
//         quoteLineId: ln.id,
//       };
//     });

//     const req = await prisma.procurementRequisition.create({
//       data: {
//         projectId,
//         status: 'SUBMITTED', // or 'DRAFT' if you want a later submit step
//         items: { create: itemsData },
//       },
//       select: { id: true },
//     });

//     redirect(`/procurement/requisitions/${req.id}`);
//   };

//   return (
//     <div className="p-6 space-y-4">
//       <h1 className="text-2xl font-semibold">Create Requisit999999ion</h1>

//       <form action={createAction} className="rounded border bg-white p-4">
//         <table className="min-w-full text-sm">
//           <thead className="bg-gray-50">
//             <tr className="text-left">
//               <th className="px-2 py-2">Include</th>
//               <th className="px-2 py-2">Description</th>
//               <th className="px-2 py-2">Unit</th>
//               <th className="px-2 py-2">Quote Qty</th>
//               <th className="px-2 py-2">Qty to Request</th>
//             </tr>
//           </thead>
//           <tbody>
//             {lines.map((l) => (
//               <tr key={l.id} className="border-b last:border-b-0">
//                 <td className="px-2 py-2">
//                   <input type="checkbox" name={`pick-${l.id}`} />
//                 </td>
//                 <td className="px-2 py-2">{l.description}</td>
//                 <td className="px-2 py-2">{fmtUnit(l.unit)}</td>
//                 <td className="px-2 py-2">{Number(l.quantity ?? 0)}</td>
//                 <td className="px-2 py-2">
//                   <input
//                     name={`qty-${l.id}`}
//                     type="number"
//                     min={0}
//                     step="0.01"
//                     defaultValue={Number(l.quantity ?? 0).toString()}
//                     className="w-28 rounded border px-2 py-1"
//                   />
//                 </td>
//               </tr>
//             ))}
//           </tbody>
//         </table>

//         <div className="mt-4">
//           <button className="rounded bg-slate-900 px-4 py-2 text-white">Create Requisition</button>
//         </div>
//       </form>
//     </div>
//   );
// }

// app/(protected)/projects/[projectId]/requisitions/new/page.tsx
import { getProjectQuoteLinesWithRemaining } from '@/app/lib/requisition';
import { createRequisitionFromQuotePicks } from '@/app/(protected)/projects/actions'; // we'll write below
import SubmitButton from '@/components/SubmitButton';

export default async function NewRequisitionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const lines = await getProjectQuoteLinesWithRemaining(projectId);

  console.log('Project ID:', projectId);
  console.log('jhdsjhjdshjdsahhjashjashjsah');
  console.log('Quote lines with remaining:', lines);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Create Requisition</h1>

      <form action={createRequisitionFromQuotePicks}>
        <input type="hidden" name="projectId" value={projectId} />
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1">Include</th>
                <th className="px-2 py-1 text-left">Description</th>
                <th className="px-2 py-1">Unit</th>
                <th className="px-2 py-1 text-right">Quote Qty</th>
                <th className="px-2 py-1 text-right">Already Req.</th>
                <th className="px-2 py-1 text-right">Qty to Request</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.quoteLineId} className="border-b last:border-b-0">
                  <td className="px-2 py-1 text-center">
                    {l.remaining > 0 ? (
                      <input type="checkbox" name={`pick-${idx}-include`} defaultChecked />
                    ) : (
                      <input type="checkbox" disabled />
                    )}
                    <input type="hidden" name={`pick-${idx}-quoteLineId`} value={l.quoteLineId} />
                  </td>
                  <td className="px-2 py-1">{l.description}</td>
                  <td className="px-2 py-1 text-center">{l.unit}</td>
                  <td className="px-2 py-1 text-right">{l.quoteQty}</td>
                  <td className="px-2 py-1 text-right">{l.alreadyRequested}</td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      max={l.remaining}
                      defaultValue={l.remaining}
                      name={`pick-${idx}-qty`}
                      className="w-24 rounded border px-2 py-1 text-right"
                      disabled={l.remaining === 0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <SubmitButton className="rounded bg-slate-900 px-4 py-2 text-white">
            Create Requisition
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
