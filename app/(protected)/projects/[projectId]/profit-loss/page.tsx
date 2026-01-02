// app/(protected)/projects/[projectId]/profit-loss/page.tsx
import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { buildProjectPnL } from '../helpers/pnl';
import Money from '@/components/Money';
import { fromMinor } from '@/helpers/money';

export default async function ProjectProfitLossPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const me = await getCurrentUser();
  if (!me) return <div className="p-6 text-sm text-gray-600">Authentication required.</div>;

  const data = await buildProjectPnL(projectId);

  if (!data.quoteId) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Project Profit & Loss</h2>
        <p className="mt-2 text-sm text-gray-600">No quote associated with this project yet.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">Project Profit & Loss</h2>

      <div className="rounded border bg-white p-4">
        <div className="text-sm text-gray-600">Quote: {data.quoteId}</div>
        <div className="mt-3 overflow-x-auto">
          {Object.entries(data.sections).map(([section, info]) => {
            return (
              <div key={section} className="mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{section}</h3>
                  <div className="text-sm">
                    <span className="text-gray-500">Quoted:</span>{' '}
                    <strong>{fromMinor(info.sectionTotalMinor).toFixed(2)}</strong> ·{' '}
                    <span
                      className={info.sectionPnlMinor >= 0n ? 'text-emerald-600' : 'text-red-600'}
                    >
                      P/L: <strong>{fromMinor(info.sectionPnlMinor).toFixed(2)}</strong>
                    </span>
                  </div>
                </div>

                <table className="w-full text-sm mt-3">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-right">Req qty</th>
                      <th className="p-2 text-right">Extra req</th>
                      <th className="p-2 text-right">Quoted unit</th>
                      <th className="p-2 text-right">Quoted total</th>
                      <th className="p-2 text-right">Purchased qty</th>
                      <th className="p-2 text-right">Purchased total</th>
                      <th className="p-2 text-right">Avg purchase unit</th>
                      <th className="p-2 text-right">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.lines.map((ln) => {
                      const pnlPos = ln.pnlMinor >= 0n;
                      return (
                        <tr key={ln.lineId} className="border-b">
                          <td className="p-2">{ln.description}</td>
                          <td className="p-2 text-right">{ln.qtyOrdered}</td>
                          <td className="p-2 text-right text-amber-600">
                            {ln.extraRequestedQty ? `+${ln.extraRequestedQty}` : '—'}
                          </td>
                          <td className="p-2 text-right">
                            {fromMinor(ln.quotedUnitMinor).toFixed(2)}
                          </td>
                          <td className="p-2 text-right">
                            {fromMinor(ln.quotedTotalMinor).toFixed(2)}
                          </td>
                          <td className="p-2 text-right">{ln.purchasedQty}</td>
                          <td className="p-2 text-right">
                            {fromMinor(ln.purchasedTotalMinor).toFixed(2)}
                          </td>
                          <td className="p-2 text-right">
                            {ln.avgPurchaseUnitMinor
                              ? fromMinor(ln.avgPurchaseUnitMinor).toFixed(2)
                              : '—'}
                          </td>
                          <td
                            className={`p-2 text-right ${pnlPos ? 'text-emerald-600' : 'text-red-600'}`}
                          >
                            {fromMinor(ln.pnlMinor).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t pt-4 text-sm">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-gray-500">Grand quoted</div>
              <div className="font-semibold">{fromMinor(data.grandQuotedMinor).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500">Grand purchased</div>
              <div className="font-semibold">{fromMinor(data.grandPurchasedMinor).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-500">Gross P/L</div>
              <div
                className={
                  data.grandPnlMinor >= 0n
                    ? 'text-emerald-600 font-semibold'
                    : 'text-red-600 font-semibold'
                }
              >
                {fromMinor(data.grandPnlMinor).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
