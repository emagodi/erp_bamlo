
// app/(protected)/procurement/purchase-orders/[poId]/page.tsx
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { placeOrder, receiveGoods } from '../actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VerifyPoGrnsForm from '../VerifyPoGrnsForm';
import SubmitButton from '@/components/SubmitButton';
import Link from 'next/link';
import Money from '@/components/Money';

function POStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    PURCHASED: 'bg-purple-100 text-purple-800',
    PARTIAL: 'bg-orange-100 text-orange-800',
    RECEIVED: 'bg-green-100 text-green-800',
    COMPLETE: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

export default async function POPage(props: { params: Promise<{ poId: string }> }) {
  const params = await props.params;
  const { poId } = params;
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required.</div>;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { 
      items: true, 
      requisition: { include: { project: true } },
      goodsReceivedNotes: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      purchases: true, // Fetch staged items to correlate
      createdBy: { select: { name: true, email: true } },
      decidedBy: { select: { name: true, email: true } },
    },
  });
  if (!po) return <div className="p-6">PO not found.</div>;

  const isProcurement = me.role === 'PROCUREMENT' || me.role === 'SENIOR_PROCUREMENT' || me.role === 'ADMIN';
  const isAccounts = me.role === 'SALES_ACCOUNTS' || (me.role as string).startsWith('ACCOUNT') || me.role === 'ADMIN';
  const isSecurity = me.role === 'SECURITY' || me.role === 'ADMIN';

  // Calculate received quantities (Verified 'Accepted' + Pending 'Delivered')
  const receivedByItem = new Map<string, number>();
  po.goodsReceivedNotes.forEach((grn) => {
    grn.items.forEach((grnItem) => {
      if (grnItem.poItemId) {
        const current = receivedByItem.get(grnItem.poItemId) ?? 0;
        // If Pending, we count what was Delivered (occupying the slot)
        // If Verified, we count what was Accepted (rejected items are freed up)
        const used = grn.status === 'PENDING' ? grnItem.qtyDelivered : grnItem.qtyAccepted;
        receivedByItem.set(grnItem.poItemId, current + used);
      }
    });
  });

  const isPOFullyReceived = po.items.every((item) => {
    const used = receivedByItem.get(item.id) ?? 0;
    return used >= item.qty;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border shadow-sm">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">PO {po.id.slice(0, 8)}</h1>
            <POStatusBadge status={po.status} />
          </div>
          <div className="mt-1 text-sm text-gray-500 space-y-1">
            <p>Vendor: <span className="font-medium text-gray-900">{po.vendor ?? '-'}</span></p>
            <p>Project: <span className="font-medium text-gray-900">{po.requisition?.projectId.slice(0, 8) ?? '-'}</span></p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/procurement/purchase-orders"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
          >
            Back to POs
          </Link>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Requested Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><Money minor={po.requestedMinor} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600"><Money minor={po.approvedMinor} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Received Progress</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-sm text-muted-foreground">
               {isPOFullyReceived ? 'All items received' : 'Pending deliveries'}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {isProcurement && po.status === 'APPROVED' && (
        <Card>
          <CardHeader>
            <CardTitle>Place Order</CardTitle>
            <CardDescription>Mark this PO as purchased after placing the order with the vendor.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async () => {
                'use server';
                await placeOrder(poId, me.id!);
                revalidatePath(`/procurement/purchase-orders/${poId}`);
              }}
            >
              <SubmitButton className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                Place Order (Mark as PURCHASED)
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Receive Goods Section */}
      {/* Only show if NOT fully received and user is Security/Admin */}
      {isSecurity && !isPOFullyReceived && (
        <Card className="border-emerald-200 shadow-md">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <span>Receive Goods</span>
            </CardTitle>
            <CardDescription>Record the delivery of items. Verification will be done by Accounts.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form
              action={async (fd) => {
                'use server';
                // Collect all items with > 0 delivery
                const rawItems = po.items.map((item) => {
                   const qty = Number(fd.get(`delivered-${item.id}`) || 0);
                   return {
                     poItemId: item.id,
                     qtyDelivered: qty,
                     vendorName: String(fd.get(`vendor-${item.id}`) || '').trim(),
                     receiptNumber: String(fd.get(`receipt-${item.id}`) || '').trim(),
                     vendorPhone: String(fd.get(`phone-${item.id}`) || '').trim(),
                     unitPriceMajor: Number(fd.get(`price-${item.id}`) || 0),
                   };
                }).filter(i => i.qtyDelivered > 0);

                if (rawItems.length === 0) throw new Error('Enter at least one delivery quantity');

                // Validate required fields for entered items
                for (const item of rawItems) {
                    if (!item.vendorName) throw new Error('Vendor Name is required for all delivered items');
                    if (!item.receiptNumber) throw new Error('Receipt Number is required for all delivered items');
                }
                
                // Global fields
                const details = {
                  receivedAt: String(fd.get('receivedAt') || new Date().toISOString()),
                  note: String(fd.get('note') || ''),
                };

                await receiveGoods(poId, rawItems, me.id!, details);
                revalidatePath(`/procurement/purchase-orders/${poId}`);
              }}
              className="space-y-6"
            >
              {/* Common Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-xl border shadow-sm">
                 <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-700">Date Received</label>
                    <input 
                      name="receivedAt" 
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="flex h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-white hover:border-gray-300"
                      required
                    />
                 </div>
              </div>

              <div className="rounded-xl border shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/80 border-b">
                      <tr>
                        <th className="px-6 py-4 text-left font-semibold text-gray-700 min-w-[200px]">Item Description</th>
                        <th className="px-4 py-4 text-right font-semibold text-gray-700 w-[100px]">Ordered</th>
                        <th className="px-4 py-4 text-right font-semibold text-gray-700 w-[100px]">Used</th>
                        
                        {/* Input Group Headers */}
                        <th className="px-4 py-4 text-left font-semibold text-gray-700 min-w-[180px]">From Vendor</th>
                        <th className="px-4 py-4 text-left font-semibold text-gray-700 min-w-[140px]">Contact #</th>
                        <th className="px-4 py-4 text-left font-semibold text-gray-700 min-w-[140px]">Docket / Inv #</th>
                        <th className="px-4 py-4 text-right font-semibold text-emerald-700 min-w-[120px]">Qty In</th>
                        <th className="px-4 py-4 text-right font-semibold text-gray-700 min-w-[120px]">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {po.items.map((item) => {
                        const used = receivedByItem.get(item.id) ?? 0;
                        const remaining = Math.max(0, item.qty - used);
                        const defaultPriceMajor = item.unitPriceMinor ? Number(item.unitPriceMinor) / 100 : 0;
                        const isComplete = remaining <= 0;

                        // Find correlating staged purchase (Same RequisitionItem)
                        const staged = po.purchases.find(p => p.requisitionItemId === item.requisitionItemId);
                        
                        // If Staged, we pre-fill Vendor/Phone but Force Empty everything else
                        // If Not Staged (Purchase Materials), everything is empty
                        const prefillVendor = staged?.vendor ?? '';
                        const prefillPhone = staged?.vendorPhone ?? '';
                        
                        // Security must always verify/enter Qty, Price, Ref.
                        // For Staged items, even though we have a price, Security must verify it against the invoice.
                        // So we do NOT pre-fill price/qty for staged items either, which matches the request.
                        // Standard items (not staged) also have empty fields.

                        return (
                          <tr key={item.id} className={`group transition-colors hover:bg-slate-50 ${isComplete ? 'bg-gray-50/50' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{item.description}</div>
                              {isComplete && <span className="text-xs text-green-600 font-medium mt-1 inline-block">Order Complete</span>}
                            </td>
                            <td className="px-4 py-4 text-right text-gray-500 font-medium">{item.qty} {item.unit ?? ''}</td>
                            <td className="px-4 py-4 text-right text-gray-500">{used}</td>
                            
                            {/* Vendor Input */}
                            <td className="px-4 py-4">
                                <input
                                name={`vendor-${item.id}`}
                                disabled={isComplete}
                                defaultValue={!isComplete ? prefillVendor : ''}
                                className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm placeholder:text-gray-300 focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder={isComplete ? "-" : "Vendor Name"}
                              />
                            </td>
                            
                             {/* Phone Input */}
                            <td className="px-4 py-4">
                               <input
                                name={`phone-${item.id}`}
                                disabled={isComplete}
                                defaultValue={!isComplete ? prefillPhone : ''}
                                className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm placeholder:text-gray-300 focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder={isComplete ? "-" : "Phone"}
                              />
                            </td>
                            
                            {/* Receipt Input */}
                            <td className="px-4 py-4">
                               <input
                                name={`receipt-${item.id}`}
                                disabled={isComplete}
                                className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm placeholder:text-gray-300 focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder={isComplete ? "-" : "Doc/Inv No."}
                              />
                            </td>

                            {/* Qty Input */}
                            <td className="px-4 py-4 text-right">
                              <div className="relative">
                                <input
                                  name={`delivered-${item.id}`}
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  max={remaining > 0 ? remaining : undefined} 
                                  placeholder={isComplete ? "Done" : "0"}
                                  disabled={isComplete}
                                  className={`w-full h-9 rounded-md border bg-white px-3 text-right text-sm font-medium transition-all outline-none focus:ring-1 disabled:bg-gray-100 disabled:text-gray-400 ${remaining > 0 ? 'border-emerald-200 text-emerald-700 focus:border-emerald-500 focus:ring-emerald-500 placeholder:text-emerald-200' : 'border-gray-200 text-gray-400'}`}
                                />
                              </div>
                            </td>

                            {/* Price Input */}
                             <td className="px-4 py-4 text-right">
                              <div className="relative">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isComplete ? 'text-gray-300' : 'text-gray-400'}`}>$</span>
                                  <input
                                  name={`price-${item.id}`}
                                  type="number"
                                  step="0.01"
                                  // For Staged Items (and regular), this should be empty for Security to enter.
                                  // We only show placeholder.
                                  placeholder={ "0.00"}
                                  disabled={isComplete}
                                  className="w-full h-9 rounded-md border border-gray-200 bg-white pl-6 pr-3 text-right text-sm transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-100 disabled:text-gray-400"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="space-y-3 p-1">
                <label className="text-sm font-semibold text-gray-700">Delivery Notes (Optional)</label>
                <textarea
                  name="note"
                  placeholder="Any additional comments about the delivery condition, weather, etc..."
                  className="flex min-h-[80px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all"
                />
              </div>
              <div className="flex justify-end pt-4">
                <SubmitButton className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 h-11 px-8">
                  Confirm Receipt
                </SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Fully Received Message */}
      {isSecurity && isPOFullyReceived && (
         <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
               <CardTitle className="text-green-800 flex items-center gap-2">
                 <span>✅ Order Complete</span>
               </CardTitle>
               <CardDescription className="text-green-700">
                 All items in this Purchase Order have been fully received and/or verified.
               </CardDescription>
            </CardHeader>
         </Card>
      )}

      {/* Verify GRN Section */}
      {/* Verify GRN Section - Aggregated */}
      {isAccounts && po.goodsReceivedNotes.some(g => g.status === 'PENDING') && (
        <div className="space-y-4">
           {(() => {
             const pendingItems = po.goodsReceivedNotes
               .filter(g => g.status === 'PENDING')
               .flatMap(grn => grn.items.map(item => ({
                   grnId: grn.id,
                   grnItemId: item.id,
                   description: item.description,
                   qtyDelivered: item.qtyDelivered,
                   priceMinor: item.priceMinor ? Number(item.priceMinor) : 0,
                   varianceMinor: item.varianceMinor ? Number(item.varianceMinor) : 0,
                   receiptNumber: grn.receiptNumber || 'N/A',
                   vendorName: grn.vendorName || 'N/A',
                   receivedAt: grn.receivedAt ? grn.receivedAt.toISOString() : ''
               })));
             
             return (
                <VerifyPoGrnsForm 
                   poId={params.poId} 
                   verifierId={me.id!} 
                   items={pendingItems} 
                />
             );
          })()}
        </div>
      )}

      {/* PO Items */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Item</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-left font-medium">Unit</th>
                  <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-right font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((it) => {
                  const received = receivedByItem.get(it.id) ?? 0;
                  return (
                    <tr key={it.id} className="border-t">
                      <td className="px-4 py-2">{it.description}</td>
                      <td className="px-4 py-2 text-right">{it.qty}</td>
                      <td className="px-4 py-2">{it.unit ?? '-'}</td>
                      <td className="px-4 py-2 text-right"><Money minor={it.unitPriceMinor} /></td>
                      <td className="px-4 py-2 text-right"><Money minor={it.totalMinor} /></td>
                      <td className="px-4 py-2 text-right">{received} / {it.qty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>


      {/* GRN History */}
      {po.goodsReceivedNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Goods Received Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {po.goodsReceivedNotes.map((grn) => (
                <div key={grn.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">GRN {grn.id.slice(0, 8)}</div>
                      <div className="text-xs text-gray-500">
                        Received: {grn.receivedAt ? new Date(grn.receivedAt).toLocaleString() : '-'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Vendor: <span className="font-medium text-gray-700">{grn.vendorName || 'N/A'}</span> • 
                        Phone: <span className="font-medium text-gray-700">{grn.vendorPhone || 'N/A'}</span> • 
                        Receipt: <span className="font-medium text-gray-700">{grn.receiptNumber || 'N/A'}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {grn.status}
                    </span>
                  </div>
                  {grn.note && <p className="text-sm text-gray-600 mb-2">{grn.note}</p>}
                  <div className="rounded-md border mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-2 py-1 text-left text-xs">Item</th>
                          <th className="px-2 py-1 text-right text-xs">Delivered</th>
                          <th className="px-2 py-1 text-right text-xs">Price</th>
                          <th className="px-2 py-1 text-right text-xs">P&L</th>
                          <th className="px-2 py-1 text-right text-xs">Accepted</th>
                          <th className="px-2 py-1 text-right text-xs">Rejected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grn.items.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-2 py-1">{item.description}</td>
                            <td className="px-2 py-1 text-right">{item.qtyDelivered}</td>
                            <td className="px-2 py-1 text-right">
                              {item.priceMinor ? <Money minor={item.priceMinor} /> : '-'}
                            </td>
                            <td className={`px-2 py-1 text-right font-medium ${(item.varianceMinor && Number(item.varianceMinor)) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {item.varianceMinor ? <Money minor={item.varianceMinor} /> : '-'}
                            </td>
                            <td className="px-2 py-1 text-right">{item.qtyAccepted}</td>
                            <td className="px-2 py-1 text-right">{item.qtyRejected}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
