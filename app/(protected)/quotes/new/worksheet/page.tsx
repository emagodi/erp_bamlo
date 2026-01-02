import WorksheetQuoteBuilder from '@/components/WorksheetQuoteBuilder';

export default function WorksheetPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Quote — Worksheet</h1>
      <p className="text-sm text-gray-600">Enter all values; amounts and section totals compute in real time, matching your quotation layout. Save to create a draft quote.</p>
      <WorksheetQuoteBuilder />
    </div>
  );
}

