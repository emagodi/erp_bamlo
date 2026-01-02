// app/(protected)/dispatches/[dispatchId]/receipt/page.tsx  (Server Component)
import PrintButton from '@/components/PrintButton';
import { markDispatchSent, markDispatchReceived } from './actions';

export default async function ReceiptPage({ params }: { params: Promise<{ dispatchId: string }> }) {
  const { dispatchId } = await params;
  // ...load dispatch, items, etc.

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dispatch Receipt #{dispatchId}</h1>
        <div className="flex gap-2">
          <PrintButton />
        </div>
      </header>

      {/* … your receipt table … */}

      <div className="flex gap-2">
        {/* Use server actions via <form action={...}> for mutations */}
        <form action={markDispatchSent.bind(null, dispatchId)}>
          <button className="rounded bg-indigo-600 px-3 py-1.5 text-white">Mark Sent</button>
        </form>

        <form action={markDispatchReceived.bind(null, dispatchId)}>
          <button className="rounded bg-emerald-600 px-3 py-1.5 text-white">Mark Received</button>
        </form>
      </div>
    </div>
  );
}
