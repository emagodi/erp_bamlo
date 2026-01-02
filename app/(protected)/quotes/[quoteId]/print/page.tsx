import { getPdfRenderer } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export default async function PrintQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const renderer = await getPdfRenderer();
  const pdf = await renderer.render({ quoteId });
  // Render a simple download link and inline preview by data URL
  const href = `data:application/pdf;base64,${pdf.buffer.toString('base64')}`;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">PDF Preview</h1>
      <a download={pdf.filename} href={href} className="px-4 py-2 bg-blue-600 text-white rounded">Download PDF</a>
      <iframe src={href} className="w-full h-[80vh] border" />
    </div>
  );
}
