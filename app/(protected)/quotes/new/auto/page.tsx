import AutoQuoteForm from './ui/AutoQuoteForm';

export default async function AutoNewQuotePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Automate: Create Quote from Excel Rules</h1>
      <AutoQuoteForm />
    </div>
  );
}

