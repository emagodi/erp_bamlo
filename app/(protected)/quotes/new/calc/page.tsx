import CalcBuilder from '@/components/CalcBuilder';

export default function CalcQuotePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Quote — Calculator</h1>
      <p className="text-sm text-gray-600">Enter base measurements; derived fields update in real time. Select rows to include and set unit prices to create a quote.</p>
      <CalcBuilder />
    </div>
  );
}

